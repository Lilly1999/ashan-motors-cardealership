import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { join, resolve } from 'node:path';
import {
  Car,
  CarInput,
  FileInventoryStore,
  InventoryStore,
  Photo,
  PostgresInventoryStore,
  readInventoryFile,
} from './inventory.store';

export type { Car, CarInput } from './inventory.store';

export interface UploadedPhoto {
  mimetype: string;
  buffer: Buffer;
}

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);
  private readonly inventoryFile = resolve(process.env.INVENTORY_FILE ?? join(process.cwd(), 'data', 'inventory.json'));
  private readonly store: InventoryStore;
  private readonly adminPassword = process.env.ADMIN_PASSWORD ?? 'ashan-demo-2026';
  // Sign-in tokens are signed rather than kept in memory, so they keep working across serverless
  // instances and server restarts. Changing ADMIN_PASSWORD or SESSION_SECRET signs everyone out.
  private readonly tokenKey = createHash('sha256')
    .update(`${process.env.SESSION_SECRET ?? 'ashan-motors-session'}:${this.adminPassword}`)
    .digest();
  private readonly loginAttempts = new Map<string, { count: number; resetAt: number }>();

  constructor() {
    if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
      throw new Error('ADMIN_PASSWORD must be configured in production.');
    }
    if (process.env.VERCEL && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be configured on Vercel (the file system is read-only there).');
    }
    const seed = () => readInventoryFile(this.inventoryFile) ?? sampleInventory();
    this.store = process.env.DATABASE_URL
      ? new PostgresInventoryStore(process.env.DATABASE_URL, seed)
      : new FileInventoryStore(this.inventoryFile, seed);
  }

  async onModuleInit(): Promise<void> {
    await this.store.init();
    this.logger.log(process.env.DATABASE_URL ? 'Inventory storage: PostgreSQL' : `Inventory storage: JSON file (${this.inventoryFile})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.store.close();
  }

  getCars(): Promise<Car[]> {
    return this.store.listCars();
  }

  async getCar(id: string): Promise<Car> {
    const car = await this.store.getCar(id);
    if (!car) throw new NotFoundException('Car not found.');
    return car;
  }

  createCar(input: CarInput): Promise<Car> {
    return this.store.createCar({ newArrival: true, ...input, id: randomUUID(), createdAt: new Date().toISOString() });
  }

  async updateCar(id: string, input: CarInput): Promise<Car> {
    const existing = await this.getCar(id);
    const car = await this.store.updateCar(id, { ...input, newArrival: input.newArrival ?? existing.newArrival });
    if (!car) throw new NotFoundException('Car not found.');
    return car;
  }

  async deleteCar(id: string): Promise<void> {
    if (!(await this.store.deleteCar(id))) throw new NotFoundException('Car not found.');
  }

  getCollections(): Promise<string[]> {
    return this.store.listCollections();
  }

  async createCollection(name: string): Promise<string[]> {
    if (!(await this.store.addCollection(name.trim()))) throw new ConflictException('That collection already exists.');
    return this.store.listCollections();
  }

  async deleteCollection(name: string): Promise<string[]> {
    if (await this.store.collectionInUse(name)) {
      throw new ConflictException('Move the cars in this collection before deleting it.');
    }
    await this.store.deleteCollection(name);
    return this.store.listCollections();
  }

  /** Stores photos and returns site-relative links (/api/photos/… or /uploads/…), so they work on any domain. */
  async savePhotos(files: UploadedPhoto[]): Promise<string[]> {
    if (!files.length) throw new BadRequestException('Choose at least one photo to upload.');
    if (files.some((file) => !PHOTO_TYPES.has(file.mimetype))) {
      throw new BadRequestException('Photos must be JPG, PNG, WebP or AVIF images.');
    }
    const urls: string[] = [];
    for (const file of files) {
      const id = await this.store.savePhoto({ mimetype: file.mimetype, data: file.buffer });
      urls.push(this.store.storesPhotos ? `/api/photos/${id}` : `/uploads/${id}`);
    }
    return urls;
  }

  async getPhoto(id: string): Promise<Photo> {
    const photo = await this.store.getPhoto(id);
    if (!photo) throw new NotFoundException('Photo not found.');
    return photo;
  }

  login(password: string, clientId: string): string {
    const now = Date.now();
    const attempts = this.loginAttempts.get(clientId);
    if (attempts && attempts.resetAt > now && attempts.count >= 5) {
      throw new HttpException('Too many sign-in attempts. Try again in 15 minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const supplied = Buffer.from(password);
    const expected = Buffer.from(this.adminPassword);
    const matches = supplied.length === expected.length && timingSafeEqual(supplied, expected);
    if (!matches) {
      const current = attempts && attempts.resetAt > now ? attempts : { count: 0, resetAt: now + 15 * 60_000 };
      current.count += 1;
      this.loginAttempts.set(clientId, current);
      throw new UnauthorizedException('That password is incorrect.');
    }

    this.loginAttempts.delete(clientId);
    const payload = Buffer.from(JSON.stringify({ exp: now + 8 * 60 * 60_000, n: randomUUID() })).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  isValidToken(token: string): boolean {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return false;
    const expected = Buffer.from(this.sign(payload));
    const supplied = Buffer.from(signature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;
    try {
      const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp: number };
      return typeof exp === 'number' && exp > Date.now();
    } catch {
      return false;
    }
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.tokenKey).update(payload).digest('base64url');
  }
}

function sampleInventory(): { cars: Car[]; collections: string[] } {
  const now = Date.now();
  const day = 86_400_000;
  const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=85`;
  const car = (fields: Omit<Car, 'id' | 'createdAt'>, age: number): Car => ({
    ...fields, id: randomUUID(), createdAt: new Date(now - age * day).toISOString(),
  });
  return {
    collections: ['Just landed', 'Premium selection', 'City ready'],
    cars: [
      car({ make: 'Mercedes-Benz', model: 'C-Class C200', year: 2021, price: 6_850_000, mileage: 38_400, transmission: 'Automatic', fuel: 'Petrol', body: 'Saloon', engine: '1,500cc', drive: '2WD', seats: 5,
        description: 'A beautifully kept C200 with a refined cabin, panoramic roof and a smooth, confident drive. Full service history included.',
        status: 'available', newArrival: true, collection: 'Just landed', images: [photo('photo-1618843479313-40f8afb4b4d8')] }, 0),
      car({ make: 'Porsche', model: 'Macan S', year: 2022, price: 15_900_000, mileage: 21_600, transmission: 'Automatic', fuel: 'Petrol', body: 'SUV', engine: '2,900cc', drive: 'AWD', seats: 5,
        description: 'A compelling blend of everyday comfort and unmistakable Porsche performance, finished with premium leather and all-wheel drive.',
        status: 'available', newArrival: true, collection: 'Premium selection', images: [photo('photo-1503376780353-7e6692767b70')] }, 1),
      car({ make: 'Toyota', model: 'Land Cruiser Prado TX-L', year: 2020, price: 9_750_000, mileage: 54_200, transmission: 'Automatic', fuel: 'Diesel', body: 'SUV', engine: '2,800cc', drive: '4WD', seats: 7,
        description: 'Ready for the open road. This well-maintained Prado pairs a capable diesel engine with a spacious, comfortable seven-seat cabin.',
        status: 'available', newArrival: true, collection: 'Just landed', images: [photo('photo-1519641471654-76ce0107ad1b')] }, 2),
      car({ make: 'BMW', model: '3 Series 320i', year: 2019, price: 4_250_000, mileage: 62_800, transmission: 'Automatic', fuel: 'Petrol', body: 'Saloon', engine: '2,000cc', drive: '2WD', seats: 5,
        description: 'A sharp, engaging saloon with clean lines, a well-appointed interior and the responsive handling the 3 Series is known for.',
        status: 'available', newArrival: false, collection: 'City ready', images: [photo('photo-1555215695-3004980ad54e')] }, 3),
      car({ make: 'Range Rover', model: 'Evoque R-Dynamic', year: 2021, price: 8_300_000, mileage: 31_100, transmission: 'Automatic', fuel: 'Diesel', body: 'SUV', engine: '2,000cc', drive: 'AWD', seats: 5,
        description: 'Distinctive R-Dynamic styling with a composed ride, modern driver assistance and a versatile, premium interior.',
        status: 'sold', newArrival: false, collection: 'Premium selection', images: [photo('photo-1518987048-93e29699e79a')] }, 4),
    ],
  };
}
