import { Component, computed, effect, HostListener, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { CarCard } from '../car-card';
import { InventoryService } from '../inventory.service';
import { SITE_CONFIG } from '../site-config';
import { SocialIcon } from '../social-icon';

@Component({
  selector: 'app-car-detail',
  imports: [DatePipe, DecimalPipe, RouterLink, CarCard, SocialIcon],
  templateUrl: './car-detail.html',
})
export class CarDetail {
  private readonly titleService = inject(Title);
  protected readonly inventory = inject(InventoryService);
  protected readonly config = SITE_CONFIG;
  readonly id = input.required<string>();
  protected readonly photoIndex = signal(0);
  protected readonly shareMessage = signal('');

  protected readonly car = computed(() => this.inventory.cars().find((item) => item.id === this.id()) ?? null);
  protected readonly similar = computed(() => {
    const car = this.car();
    if (!car) return [];
    return this.inventory.available()
      .filter((item) => item.id !== car.id && (item.body === car.body || item.make === car.make))
      .sort((a, b) => Math.abs(a.price - car.price) - Math.abs(b.price - car.price))
      .slice(0, 4);
  });
  protected readonly specs = computed(() => {
    const car = this.car();
    if (!car) return [];
    return [
      ['Make', car.make], ['Model', car.model], ['Year', String(car.year)], ['Body type', car.body],
      ['Mileage', `${car.mileage.toLocaleString('en-KE')} km`], ['Transmission', car.transmission], ['Fuel', car.fuel],
      ['Engine', car.engine], ['Drive', car.drive], ['Seats', car.seats ? String(car.seats) : ''], ['Colour', car.color],
      ['Collection', car.collection],
    ].filter((row): row is [string, string] => Boolean(row[1]));
  });

  constructor() {
    effect(() => {
      this.id();
      this.photoIndex.set(0);
    });
    effect(() => {
      const car = this.car();
      this.titleService.setTitle(car ? `${this.inventory.title(car)} | Ashan Motors` : 'Car not found | Ashan Motors');
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select')) return;
    if (event.key === 'ArrowRight') this.step(1);
    if (event.key === 'ArrowLeft') this.step(-1);
  }

  step(direction: number): void {
    const count = this.car()?.images.length ?? 0;
    if (count > 1) this.photoIndex.update((index) => (index + direction + count) % count);
  }

  async share(): Promise<void> {
    const car = this.car();
    if (!car) return;
    const url = this.inventory.carUrl(car);
    try {
      if (navigator.share) {
        await navigator.share({ title: this.inventory.title(car), text: `${this.inventory.title(car)} – ${this.inventory.formatPrice(car.price)}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      this.shareMessage.set('Link copied');
    } catch {
      this.shareMessage.set(url);
    }
    setTimeout(() => this.shareMessage.set(''), 4000);
  }
}
