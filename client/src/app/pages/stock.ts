import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CarCard } from '../car-card';
import { InventoryService } from '../inventory.service';
import { Car, PRICE_BRACKETS } from '../models';

type Status = 'available' | 'new' | 'sold' | 'saved' | 'all';

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'available', label: 'In stock' },
  { value: 'new', label: 'New arrivals' },
  { value: 'sold', label: 'Sold' },
  { value: 'saved', label: 'Saved cars' },
  { value: 'all', label: 'Everything' },
];

@Component({
  selector: 'app-stock',
  imports: [FormsModule, RouterLink, CarCard],
  templateUrl: './stock.html',
})
export class Stock {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly inventory = inject(InventoryService);
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly priceSteps = PRICE_BRACKETS.filter((bracket) => bracket.max).map((bracket) => bracket.max);
  protected readonly filtersOpen = signal(false);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private param = (key: string) => computed(() => this.params().get(key) ?? '');

  protected readonly q = this.param('q');
  protected readonly status = computed(() => (this.params().get('status') as Status | null) ?? 'available');
  protected readonly make = this.param('make');
  protected readonly model = this.param('model');
  protected readonly body = this.param('body');
  protected readonly fuel = this.param('fuel');
  protected readonly transmission = this.param('transmission');
  protected readonly collection = this.param('collection');
  protected readonly minYear = this.param('minYear');
  protected readonly maxYear = this.param('maxYear');
  protected readonly minPrice = this.param('minPrice');
  protected readonly maxPrice = this.param('maxPrice');
  protected readonly sort = computed(() => this.params().get('sort') ?? 'newest');

  private readonly all = this.inventory.cars;
  protected readonly makes = computed(() => unique(this.all().map((car) => car.make)));
  protected readonly models = computed(() => unique(this.all().filter((car) => !this.make() || car.make === this.make()).map((car) => car.model)));
  protected readonly bodies = computed(() => unique(this.all().map((car) => car.body)));
  protected readonly fuels = computed(() => unique(this.all().map((car) => car.fuel)));
  protected readonly transmissions = computed(() => unique(this.all().map((car) => car.transmission)));
  protected readonly years = computed(() => unique(this.all().map((car) => String(car.year))).reverse());

  protected readonly results = computed(() => {
    const query = this.q().trim().toLowerCase();
    const status = this.status();
    const favourites = this.inventory.favourites();
    const num = (value: string) => (value ? Number(value) : 0);
    const [minYear, maxYear, minPrice, maxPrice] = [num(this.minYear()), num(this.maxYear()), num(this.minPrice()), num(this.maxPrice())];

    const matches = (car: Car) =>
      (status === 'all'
        || (status === 'available' && car.status === 'available')
        || (status === 'new' && car.status === 'available' && this.inventory.isNew(car))
        || (status === 'sold' && car.status === 'sold')
        || (status === 'saved' && favourites.includes(car.id)))
      && (!query || `${car.make} ${car.model} ${car.year} ${car.body} ${car.fuel} ${car.color ?? ''}`.toLowerCase().includes(query))
      && (!this.make() || car.make === this.make())
      && (!this.model() || car.model === this.model())
      && (!this.body() || car.body === this.body())
      && (!this.fuel() || car.fuel === this.fuel())
      && (!this.transmission() || car.transmission === this.transmission())
      && (!this.collection() || car.collection === this.collection())
      && (!minYear || car.year >= minYear)
      && (!maxYear || car.year <= maxYear)
      && (!minPrice || car.price >= minPrice)
      && (!maxPrice || car.price <= maxPrice);

    const sorted = this.all().filter(matches);
    switch (this.sort()) {
      case 'price-low': return sorted.sort((a, b) => a.price - b.price);
      case 'price-high': return sorted.sort((a, b) => b.price - a.price);
      case 'year-new': return sorted.sort((a, b) => b.year - a.year);
      case 'mileage-low': return sorted.sort((a, b) => a.mileage - b.mileage);
      default: return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  });

  protected readonly activeFilters = computed(() => {
    const labels: Record<string, (value: string) => string> = {
      q: (v) => `“${v}”`, make: (v) => v, model: (v) => v, body: (v) => v, fuel: (v) => v, transmission: (v) => v,
      collection: (v) => v, minYear: (v) => `From ${v}`, maxYear: (v) => `Up to ${v}`,
      minPrice: (v) => `From ${this.inventory.formatPrice(+v)}`, maxPrice: (v) => `Up to ${this.inventory.formatPrice(+v)}`,
    };
    return Object.keys(labels)
      .filter((key) => this.params().get(key))
      .map((key) => ({ key, label: labels[key](this.params().get(key)!) }));
  });

  protected readonly statusLabel = computed(() => STATUS_OPTIONS.find((option) => option.value === this.status())?.label ?? 'Stock');

  set(key: string, value: string | number | null): void {
    const updates: Record<string, string | number | null> = { [key]: value === '' ? null : value };
    if (key === 'make') updates['model'] = null;
    if (key === 'status' && value === 'available') updates['status'] = null;
    if (key === 'sort' && value === 'newest') updates['sort'] = null;
    this.router.navigate([], { relativeTo: this.route, queryParams: updates, queryParamsHandling: 'merge', replaceUrl: true });
  }

  showAll(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  clearAll(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { status: this.params().get('status') }, replaceUrl: true });
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
