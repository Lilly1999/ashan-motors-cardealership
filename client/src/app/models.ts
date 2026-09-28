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
  status: 'available' | 'sold';
  /** Shown in the New Arrivals sections. Set by the admin; defaults to true for newly added cars. */
  newArrival?: boolean;
  collection: string;
  images: string[];
  createdAt: string;
}

export type CarForm = Omit<Car, 'id' | 'createdAt' | 'images'>;

export const NEW_ARRIVAL_WINDOW = 14 * 86_400_000;

export const PRICE_BRACKETS = [
  { label: 'Under 1M', min: 0, max: 1_000_000 },
  { label: '1M – 2M', min: 1_000_000, max: 2_000_000 },
  { label: '2M – 3M', min: 2_000_000, max: 3_000_000 },
  { label: '3M – 5M', min: 3_000_000, max: 5_000_000 },
  { label: '5M – 8M', min: 5_000_000, max: 8_000_000 },
  { label: '8M – 12M', min: 8_000_000, max: 12_000_000 },
  { label: 'Over 12M', min: 12_000_000, max: 0 },
];

export const YEAR_BRACKETS = [
  { label: '2020 & newer', min: 2020, max: 0 },
  { label: '2017 – 2019', min: 2017, max: 2019 },
  { label: '2014 – 2016', min: 2014, max: 2016 },
  { label: '2010 – 2013', min: 2010, max: 2013 },
  { label: 'Before 2010', min: 0, max: 2009 },
];

// Short strap lines shown above each category row on the home page.
export const BODY_TAGLINES: Record<string, string> = {
  SUV: 'Adventure-ready and family-sized',
  Saloon: 'Comfortable, refined everyday drivers',
  Hatchback: 'Compact, economical and easy to park',
  Pickup: 'Tough workhorses for work and play',
  Van: 'Space for business and big families',
  'Station wagon': 'Practical room without the bulk',
  Coupe: 'Style and performance',
};

const DAY = 86_400_000;
const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=85`;

export const DEMO_CARS: Car[] = [
  {
    id: 'demo-mercedes', make: 'Mercedes-Benz', model: 'C-Class C200', year: 2021,
    price: 6_850_000, mileage: 38_400, transmission: 'Automatic', fuel: 'Petrol', body: 'Saloon',
    engine: '1,500cc', drive: '2WD', seats: 5, color: 'Grey',
    description: 'A beautifully kept C200 with a refined cabin, panoramic roof and a smooth, confident drive. Full service history included.',
    status: 'available', collection: 'Just landed', images: [photo('photo-1618843479313-40f8afb4b4d8')],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-porsche', make: 'Porsche', model: 'Macan S', year: 2022,
    price: 15_900_000, mileage: 21_600, transmission: 'Automatic', fuel: 'Petrol', body: 'SUV',
    engine: '2,900cc', drive: 'AWD', seats: 5, color: 'Black',
    description: 'A compelling blend of everyday comfort and unmistakable Porsche performance, finished with premium leather and all-wheel drive.',
    status: 'available', collection: 'Premium selection', images: [photo('photo-1503376780353-7e6692767b70')],
    createdAt: new Date(Date.now() - DAY).toISOString(),
  },
  {
    id: 'demo-toyota', make: 'Toyota', model: 'Land Cruiser Prado TX-L', year: 2020,
    price: 9_750_000, mileage: 54_200, transmission: 'Automatic', fuel: 'Diesel', body: 'SUV',
    engine: '2,800cc', drive: '4WD', seats: 7, color: 'White',
    description: 'Ready for the open road. This well-maintained Prado pairs a capable diesel engine with a spacious, comfortable seven-seat cabin.',
    status: 'available', collection: 'Just landed', images: [photo('photo-1519641471654-76ce0107ad1b')],
    createdAt: new Date(Date.now() - 2 * DAY).toISOString(),
  },
  {
    id: 'demo-bmw', make: 'BMW', model: '3 Series 320i', year: 2019,
    price: 4_250_000, mileage: 62_800, transmission: 'Automatic', fuel: 'Petrol', body: 'Saloon',
    engine: '2,000cc', drive: '2WD', seats: 5, color: 'White',
    description: 'A sharp, engaging saloon with clean lines, a well-appointed interior and the responsive handling the 3 Series is known for.',
    status: 'available', collection: 'City ready', images: [photo('photo-1555215695-3004980ad54e')],
    createdAt: new Date(Date.now() - 3 * DAY).toISOString(),
  },
  {
    id: 'demo-range-rover', make: 'Range Rover', model: 'Evoque R-Dynamic', year: 2021,
    price: 8_300_000, mileage: 31_100, transmission: 'Automatic', fuel: 'Diesel', body: 'SUV',
    engine: '2,000cc', drive: 'AWD', seats: 5,
    description: 'Distinctive R-Dynamic styling with a composed ride, modern driver assistance and a versatile, premium interior.',
    status: 'sold', collection: 'Premium selection', images: [photo('photo-1518987048-93e29699e79a')],
    createdAt: new Date(Date.now() - 4 * DAY).toISOString(),
  },
];

export const blankCar = (collection: string): CarForm => ({
  make: '', model: '', year: new Date().getFullYear(), price: 0, mileage: 0,
  transmission: 'Automatic', fuel: 'Petrol', body: 'SUV', engine: '', drive: '', seats: null, color: '',
  description: '', status: 'available', newArrival: true, collection,
});
