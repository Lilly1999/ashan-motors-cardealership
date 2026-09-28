import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Car, CarForm, DEMO_CARS, NEW_ARRIVAL_WINDOW } from './models';
import { SITE_CONFIG } from './site-config';

const API = `${SITE_CONFIG.apiBase}/api`;

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);

  readonly cars = signal<Car[]>([]);
  readonly collections = signal<string[]>(['Just landed', 'Premium selection', 'City ready']);
  readonly loading = signal(true);
  readonly apiOffline = signal(false);
  readonly favourites = signal<string[]>(this.readFavourites());
  readonly token = signal(this.readToken());

  readonly available = computed(() => this.cars().filter((car) => car.status === 'available'));
  readonly soldCount = computed(() => this.cars().length - this.available().length);
  readonly newArrivals = computed(() => this.available()
    .filter((car) => this.isNew(car))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
  readonly makes = computed(() => countBy(this.available(), (car) => car.make));
  readonly bodyTypes = computed(() => countBy(this.available(), (car) => car.body).map((item) => ({
    ...item,
    image: this.available().find((car) => car.body === item.name)?.images[0] ?? '',
  })));

  constructor() {
    this.load();
  }

  load(): void {
    this.http.get<Car[]>(`${API}/cars`).subscribe({
      next: (cars) => {
        this.cars.set(cars);
        this.loading.set(false);
        this.apiOffline.set(false);
      },
      error: () => {
        this.cars.set(DEMO_CARS);
        this.loading.set(false);
        this.apiOffline.set(true);
      },
    });
    this.http.get<string[]>(`${API}/collections`).subscribe({
      next: (collections) => this.collections.set(collections),
      error: () => undefined,
    });
  }

  isNew(car: Car): boolean {
    if (car.status === 'sold') return false;
    // Older listings saved before the admin switch existed fall back to "added in the last 14 days".
    return car.newArrival ?? Date.now() - Date.parse(car.createdAt) < NEW_ARRIVAL_WINDOW;
  }

  title(car: Car): string {
    return `${car.year} ${car.make} ${car.model}`;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: SITE_CONFIG.currency, maximumFractionDigits: 0 }).format(price);
  }

  carUrl(car: Car): string {
    return `${location.origin}/cars/${car.id}`;
  }

  contactLink(car?: Car): string {
    const text = car
      ? `Hello Ashan Motors, I'm interested in the ${this.title(car)} (${this.formatPrice(car.price)}). Is it still available?\n${this.carUrl(car)}`
      : 'Hello Ashan Motors, I would like to know more about your available cars.';
    return `https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${encodeURIComponent(text)}`;
  }

  isFavourite(id: string): boolean {
    return this.favourites().includes(id);
  }

  toggleFavourite(id: string): void {
    const next = this.isFavourite(id) ? this.favourites().filter((item) => item !== id) : [...this.favourites(), id];
    this.favourites.set(next);
    try {
      localStorage.setItem('ashan-favourites', JSON.stringify(next));
    } catch {
      // Saved cars still work for this visit when storage is unavailable.
    }
  }

  // ----- Admin -----

  login(password: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${API}/auth/login`, { password }).pipe(tap(({ token }) => {
      this.token.set(token);
      sessionStorage.setItem('ashan-admin-token', token);
    }));
  }

  logout(): void {
    this.http.post(`${API}/auth/logout`, {}, { headers: this.authHeaders() }).subscribe({ error: () => undefined });
    this.clearSession();
  }

  clearSession(): void {
    this.token.set('');
    sessionStorage.removeItem('ashan-admin-token');
  }

  saveCar(form: CarForm, images: string[], id?: string): Observable<Car> {
    const payload = { ...form, images, seats: form.seats || undefined, newArrival: form.newArrival ?? undefined };
    const request = id
      ? this.http.patch<Car>(`${API}/cars/${id}`, payload, { headers: this.authHeaders() })
      : this.http.post<Car>(`${API}/cars`, payload, { headers: this.authHeaders() });
    return request.pipe(tap((car) => {
      this.cars.update((current) => id ? current.map((item) => item.id === id ? car : item) : [car, ...current]);
      if (!this.collections().includes(car.collection)) this.collections.update((items) => [...items, car.collection]);
    }));
  }

  updateFields(car: Car, changes: Partial<CarForm>): Observable<Car> {
    const { id, createdAt, images, ...form } = car;
    return this.saveCar({ ...form, ...changes }, images, id);
  }

  deleteCar(id: string): Observable<unknown> {
    return this.http.delete(`${API}/cars/${id}`, { headers: this.authHeaders() })
      .pipe(tap(() => this.cars.update((current) => current.filter((item) => item.id !== id))));
  }

  uploadPhotos(files: File[]): Observable<{ urls: string[] }> {
    const form = new FormData();
    files.forEach((file) => form.append('photos', file));
    return this.http.post<{ urls: string[] }>(`${API}/uploads`, form, { headers: this.authHeaders() });
  }

  addCollection(name: string): Observable<string[]> {
    return this.http.post<string[]>(`${API}/collections`, { name }, { headers: this.authHeaders() })
      .pipe(tap((collections) => this.collections.set(collections)));
  }

  removeCollection(name: string): Observable<string[]> {
    return this.http.delete<string[]>(`${API}/collections/${encodeURIComponent(name)}`, { headers: this.authHeaders() })
      .pipe(tap((collections) => this.collections.set(collections)));
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token()}` });
  }

  private readToken(): string {
    try {
      return sessionStorage.getItem('ashan-admin-token') ?? '';
    } catch {
      return '';
    }
  }

  private readFavourites(): string[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem('ashan-favourites') ?? '[]');
      return Array.isArray(value) && value.every((id) => typeof id === 'string') ? value : [];
    } catch {
      return [];
    }
  }
}

function countBy(cars: Car[], key: (car: Car) => string): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const car of cars) counts.set(key(car), (counts.get(key(car)) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}
