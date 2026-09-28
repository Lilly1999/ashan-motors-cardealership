import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Pool, types } from 'pg';

export type CarStatus = 'available' | 'sold';

export interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  transmission: string;
  fuel: string;
  body: string;
  engine?: string;
  drive?: string;
  seats?: number | null;
  color?: string;
  description: string;
  status: CarStatus;
  newArrival?: boolean;
  collection: string;
  images: string[];
  createdAt: string;
}

export type CarInput = Omit<Car, 'id' | 'createdAt'>;

export interface Photo {
  mimetype: string;
  data: Buffer;
}

/** Persistence for cars, collections and (in Postgres mode) photo bytes. */
export interface InventoryStore {
  readonly storesPhotos: boolean;
  init(): Promise<void>;
  listCars(): Promise<Car[]>;
  getCar(id: string): Promise<Car | undefined>;
  createCar(car: Car): Promise<Car>;
  updateCar(id: string, input: CarInput): Promise<Car | undefined>;
  deleteCar(id: string): Promise<boolean>;
  listCollections(): Promise<string[]>;
  addCollection(name: string): Promise<boolean>;
  deleteCollection(name: string): Promise<void>;
  collectionInUse(name: string): Promise<boolean>;
  savePhoto(photo: Photo): Promise<string>;
  getPhoto(id: string): Promise<Photo | undefined>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// PostgreSQL
// ---------------------------------------------------------------------------

// Return BIGINT columns (price) as numbers rather than strings.
types.setTypeParser(20, (value) => Number(value));

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS collections (
    name        TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS collections_name_lower ON collections (lower(name));

  CREATE TABLE IF NOT EXISTS cars (
    id            UUID PRIMARY KEY,
    make          TEXT NOT NULL,
    model         TEXT NOT NULL,
    year          INTEGER NOT NULL,
    price         BIGINT NOT NULL,
    mileage       INTEGER NOT NULL,
    transmission  TEXT NOT NULL,
    fuel          TEXT NOT NULL,
    body          TEXT NOT NULL,
    engine        TEXT,
    drive         TEXT,
    seats         INTEGER,
    color         TEXT,
    description   TEXT NOT NULL,
    status        TEXT NOT NULL CHECK (status IN ('available', 'sold')),
    new_arrival   BOOLEAN NOT NULL DEFAULT TRUE,
    collection    TEXT NOT NULL,
    images        TEXT[] NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS cars_created_at ON cars (created_at DESC);
  CREATE INDEX IF NOT EXISTS cars_status ON cars (status);

  CREATE TABLE IF NOT EXISTS app_meta (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS photos (
    id          UUID PRIMARY KEY,
    mimetype    TEXT NOT NULL,
    data        BYTEA NOT NULL,
    size        INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

const CAR_COLUMNS = `id, make, model, year, price, mileage, transmission, fuel, body, engine, drive, seats, color,
  description, status, new_arrival, collection, images, created_at`;

interface CarRow {
  id: string; make: string; model: string; year: number; price: number; mileage: number;
  transmission: string; fuel: string; body: string; engine: string | null; drive: string | null;
  seats: number | null; color: string | null; description: string; status: CarStatus;
  new_arrival: boolean; collection: string; images: string[]; created_at: Date;
}

const toCar = (row: CarRow): Car => ({
  id: row.id, make: row.make, model: row.model, year: row.year, price: row.price, mileage: row.mileage,
  transmission: row.transmission, fuel: row.fuel, body: row.body,
  engine: row.engine ?? '', drive: row.drive ?? '', seats: row.seats, color: row.color ?? '',
  description: row.description, status: row.status, newArrival: row.new_arrival,
  collection: row.collection, images: row.images, createdAt: row.created_at.toISOString(),
});

const carValues = (car: CarInput) => [
  car.make, car.model, car.year, car.price, car.mileage, car.transmission, car.fuel, car.body,
  car.engine || null, car.drive || null, car.seats || null, car.color || null,
  car.description, car.status, car.newArrival ?? true, car.collection, car.images,
];

export class PostgresInventoryStore implements InventoryStore {
  readonly storesPhotos = true;
  private readonly pool: Pool;

  constructor(connectionString: string, private readonly seed: () => { cars: Car[]; collections: string[] }) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === 'true' || /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
      // Serverless platforms run many small instances, so keep each instance's pool small.
      max: Number(process.env.PG_POOL_MAX ?? (process.env.VERCEL ? 3 : 10)),
    });
  }

  async init(): Promise<void> {
    await this.pool.query(SCHEMA);
    // Seed exactly once per database. Claiming the marker row first means concurrent cold starts
    // can't both seed, and deleting every car later won't bring the samples back.
    const claimed = await this.pool.query(
      `INSERT INTO app_meta (key, value) VALUES ('seeded', now()::text) ON CONFLICT DO NOTHING RETURNING key`,
    );
    if (!claimed.rowCount) return;
    const { rows } = await this.pool.query<{ count: number }>('SELECT count(*)::int AS count FROM cars');
    if (rows[0].count > 0 || process.env.SEED_SAMPLE_DATA === 'false') return;

    // Empty database: import the existing JSON inventory (or the sample cars) once.
    const { cars, collections } = this.seed();
    for (const name of collections) await this.addCollection(name);
    for (const car of cars) await this.createCar(car);
  }

  async listCars(): Promise<Car[]> {
    const { rows } = await this.pool.query<CarRow>(`SELECT ${CAR_COLUMNS} FROM cars ORDER BY created_at DESC`);
    return rows.map(toCar);
  }

  async getCar(id: string): Promise<Car | undefined> {
    if (!isUuid(id)) return undefined;
    const { rows } = await this.pool.query<CarRow>(`SELECT ${CAR_COLUMNS} FROM cars WHERE id = $1`, [id]);
    return rows[0] && toCar(rows[0]);
  }

  async createCar(car: Car): Promise<Car> {
    await this.addCollection(car.collection);
    const { rows } = await this.pool.query<CarRow>(
      `INSERT INTO cars (make, model, year, price, mileage, transmission, fuel, body, engine, drive, seats, color,
         description, status, new_arrival, collection, images, id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING ${CAR_COLUMNS}`,
      [...carValues(car), car.id, car.createdAt],
    );
    return toCar(rows[0]);
  }

  async updateCar(id: string, input: CarInput): Promise<Car | undefined> {
    if (!isUuid(id)) return undefined;
    await this.addCollection(input.collection);
    const { rows } = await this.pool.query<CarRow>(
      `UPDATE cars SET make = $1, model = $2, year = $3, price = $4, mileage = $5, transmission = $6, fuel = $7,
         body = $8, engine = $9, drive = $10, seats = $11, color = $12, description = $13, status = $14,
         new_arrival = $15, collection = $16, images = $17, updated_at = now()
       WHERE id = $18 RETURNING ${CAR_COLUMNS}`,
      [...carValues(input), id],
    );
    return rows[0] && toCar(rows[0]);
  }

  async deleteCar(id: string): Promise<boolean> {
    if (!isUuid(id)) return false;
    const { rowCount } = await this.pool.query('DELETE FROM cars WHERE id = $1', [id]);
    return Boolean(rowCount);
  }

  async listCollections(): Promise<string[]> {
    const { rows } = await this.pool.query<{ name: string }>('SELECT name FROM collections ORDER BY lower(name)');
    return rows.map((row) => row.name);
  }

  async addCollection(name: string): Promise<boolean> {
    if (!name) return false;
    const { rowCount } = await this.pool.query('INSERT INTO collections (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    return Boolean(rowCount);
  }

  async deleteCollection(name: string): Promise<void> {
    await this.pool.query('DELETE FROM collections WHERE name = $1', [name]);
  }

  async collectionInUse(name: string): Promise<boolean> {
    const { rows } = await this.pool.query('SELECT 1 FROM cars WHERE collection = $1 LIMIT 1', [name]);
    return rows.length > 0;
  }

  async savePhoto(photo: Photo): Promise<string> {
    const id = randomUUID();
    await this.pool.query('INSERT INTO photos (id, mimetype, data, size) VALUES ($1, $2, $3, $4)', [id, photo.mimetype, photo.data, photo.data.length]);
    return id;
  }

  async getPhoto(id: string): Promise<Photo | undefined> {
    if (!isUuid(id)) return undefined;
    const { rows } = await this.pool.query<{ mimetype: string; data: Buffer }>('SELECT mimetype, data FROM photos WHERE id = $1', [id]);
    return rows[0] && { mimetype: rows[0].mimetype, data: rows[0].data };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// ---------------------------------------------------------------------------
// JSON file (local development without a database)
// ---------------------------------------------------------------------------

export const UPLOADS_DIR = resolve(process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads'));

const PHOTO_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

export class FileInventoryStore implements InventoryStore {
  readonly storesPhotos = false;
  private data: { cars: Car[]; collections: string[] } = { cars: [], collections: [] };

  constructor(private readonly path: string, private readonly seed: () => { cars: Car[]; collections: string[] }) {}

  async init(): Promise<void> {
    const saved = readInventoryFile(this.path);
    this.data = saved ?? this.seed();
    if (!saved) this.save();
  }

  async listCars(): Promise<Car[]> {
    return [...this.data.cars].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getCar(id: string): Promise<Car | undefined> {
    return this.data.cars.find((car) => car.id === id);
  }

  async createCar(car: Car): Promise<Car> {
    this.data.cars.push(car);
    this.ensureCollection(car.collection);
    this.save();
    return car;
  }

  async updateCar(id: string, input: CarInput): Promise<Car | undefined> {
    const index = this.data.cars.findIndex((car) => car.id === id);
    if (index < 0) return undefined;
    const car: Car = { ...this.data.cars[index], ...input, id };
    this.data.cars[index] = car;
    this.ensureCollection(car.collection);
    this.save();
    return car;
  }

  async deleteCar(id: string): Promise<boolean> {
    const before = this.data.cars.length;
    this.data.cars = this.data.cars.filter((car) => car.id !== id);
    this.save();
    return this.data.cars.length < before;
  }

  async listCollections(): Promise<string[]> {
    return [...this.data.collections].sort((left, right) => left.localeCompare(right));
  }

  async addCollection(name: string): Promise<boolean> {
    if (this.data.collections.some((item) => item.toLowerCase() === name.toLowerCase())) return false;
    this.data.collections.push(name);
    this.save();
    return true;
  }

  async deleteCollection(name: string): Promise<void> {
    this.data.collections = this.data.collections.filter((item) => item !== name);
    this.save();
  }

  async collectionInUse(name: string): Promise<boolean> {
    return this.data.cars.some((car) => car.collection === name);
  }

  async savePhoto(photo: Photo): Promise<string> {
    mkdirSync(UPLOADS_DIR, { recursive: true });
    const name = `${randomUUID()}.${PHOTO_EXTENSIONS[photo.mimetype]}`;
    writeFileSync(join(UPLOADS_DIR, name), photo.data);
    return name;
  }

  async getPhoto(): Promise<Photo | undefined> {
    return undefined; // Served as static files from /uploads instead.
  }

  async close(): Promise<void> {}

  private ensureCollection(name: string): void {
    if (name && !this.data.collections.includes(name)) this.data.collections.push(name);
  }

  private save(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.${randomUUID()}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(this.data, null, 2), { encoding: 'utf8', mode: 0o600 });
    renameSync(temporaryPath, this.path);
  }
}

export function readInventoryFile(path: string): { cars: Car[]; collections: string[] } | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const saved = JSON.parse(readFileSync(path, 'utf8')) as { cars: Car[]; collections: string[] };
    if (Array.isArray(saved.cars) && Array.isArray(saved.collections)) return saved;
  } catch {
    throw new Error(`Inventory file at ${path} is invalid JSON.`);
  }
  return undefined;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
