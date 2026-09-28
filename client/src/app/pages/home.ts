import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CarCard } from '../car-card';
import { InventoryService } from '../inventory.service';
import { BODY_TAGLINES, DEMO_CARS, PRICE_BRACKETS, YEAR_BRACKETS } from '../models';
import { FAQS, SITE_CONFIG } from '../site-config';
import { SocialIcon, SocialNetwork } from '../social-icon';

@Component({
  selector: 'app-home',
  imports: [FormsModule, RouterLink, CarCard, SocialIcon],
  templateUrl: './home.html',
})
export class Home {
  private readonly router = inject(Router);
  protected readonly inventory = inject(InventoryService);
  protected readonly config = SITE_CONFIG;
  protected readonly faqs = FAQS;
  protected readonly heroIndex = signal(0);

  // Search panel
  protected readonly make = signal('');
  protected readonly model = signal('');
  protected readonly body = signal('');
  protected readonly minYear = signal('');
  protected readonly maxPrice = signal('');
  protected readonly newOnly = signal(false);
  protected readonly includeSold = signal(false);

  protected readonly heroCars = computed(() => {
    const cars = this.inventory.available().filter((car) => car.images.length);
    return (cars.length ? cars : DEMO_CARS).slice(0, 5);
  });
  protected readonly heroCar = computed(() => this.heroCars()[this.heroIndex() % this.heroCars().length]);
  protected readonly models = computed(() => [...new Set(this.inventory.cars()
    .filter((car) => !this.make() || car.make === this.make())
    .map((car) => car.model))].sort());
  protected readonly years = computed(() => [...new Set(this.inventory.cars().map((car) => car.year))].sort((a, b) => b - a));
  protected readonly handpicked = computed(() => [...this.inventory.available()].sort((a, b) => b.price - a.price).slice(0, 8));
  protected readonly latest = computed(() => this.inventory.newArrivals().slice(0, 4));
  protected readonly categories = computed(() => this.inventory.bodyTypes().slice(0, 3).map((body) => ({
    ...body,
    tagline: BODY_TAGLINES[body.name] ?? 'Quality vehicles, ready to drive',
    cars: this.inventory.available().filter((car) => car.body === body.name).slice(0, 4),
  })));
  protected readonly priceBrackets = computed(() => PRICE_BRACKETS.map((bracket) => ({
    ...bracket,
    count: this.inventory.available().filter((car) => car.price >= bracket.min && (!bracket.max || car.price <= bracket.max)).length,
  })));
  protected readonly yearBrackets = computed(() => YEAR_BRACKETS.map((bracket) => ({
    ...bracket,
    count: this.inventory.available().filter((car) => car.year >= bracket.min && (!bracket.max || car.year <= bracket.max)).length,
  })));
  protected readonly socials = computed(() => ([
    { network: 'whatsapp' as SocialNetwork, label: 'WhatsApp', hint: 'Chat with sales', url: this.inventory.contactLink() },
    { network: 'instagram' as SocialNetwork, label: 'Instagram', hint: 'Photos & reels', url: SITE_CONFIG.instagramUrl },
    { network: 'tiktok' as SocialNetwork, label: 'TikTok', hint: 'Walkaround videos', url: SITE_CONFIG.tiktokUrl },
    { network: 'youtube' as SocialNetwork, label: 'YouTube', hint: 'Full car reviews', url: SITE_CONFIG.youtubeUrl },
  ]).filter((item) => item.url));

  constructor() {
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) {
      const timer = setInterval(() => this.nextHero(), 7000);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
  }

  nextHero(step = 1): void {
    const count = this.heroCars().length;
    this.heroIndex.update((index) => (index + step + count) % count);
  }

  setMake(make: string): void {
    this.make.set(make);
    this.model.set('');
  }

  searchCars(): void {
    const params: Record<string, string> = {};
    if (this.make()) params['make'] = this.make();
    if (this.model()) params['model'] = this.model();
    if (this.body()) params['body'] = this.body();
    if (this.minYear()) params['minYear'] = this.minYear();
    if (this.maxPrice()) params['maxPrice'] = this.maxPrice();
    if (this.newOnly()) params['status'] = 'new';
    else if (this.includeSold()) params['status'] = 'all';
    this.router.navigate(['/stock'], { queryParams: params });
  }

  bracketParams(bracket: { min: number; max: number }, kind: 'Price' | 'Year'): Record<string, number> {
    const params: Record<string, number> = {};
    if (bracket.min) params[`min${kind}`] = bracket.min;
    if (bracket.max) params[`max${kind}`] = bracket.max;
    return params;
  }

  plural(name: string): string {
    return /s$/i.test(name) ? name : `${name}s`;
  }
}
