import { Component, computed, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Car } from './models';
import { InventoryService } from './inventory.service';
import { SocialIcon } from './social-icon';

@Component({
  selector: 'app-car-card',
  imports: [DecimalPipe, RouterLink, SocialIcon],
  template: `
    @let item = car();
    <article class="car-card" [class.is-sold]="item.status === 'sold'">
      <a class="car-photo" [routerLink]="['/cars', item.id]" [attr.aria-label]="'View ' + inventory.title(item)">
        <img [src]="item.images[0]" [alt]="inventory.title(item)" loading="lazy">
        <span class="status-badge" [attr.data-tone]="badge().tone">{{ badge().label }}</span>
        @if (item.images.length > 1) { <span class="photo-count">▣ {{ item.images.length }}</span> }
      </a>
      <button class="favourite-button" type="button" [class.saved]="inventory.isFavourite(item.id)" (click)="inventory.toggleFavourite(item.id)"
        [attr.aria-label]="inventory.isFavourite(item.id) ? 'Remove from saved cars' : 'Save car'" [attr.aria-pressed]="inventory.isFavourite(item.id)">
        {{ inventory.isFavourite(item.id) ? '♥' : '♡' }}
      </button>
      <div class="car-info">
        <span class="car-make">{{ item.make }}</span>
        <a class="car-model" [routerLink]="['/cars', item.id]">{{ item.model }}</a>
        <strong class="car-price">{{ inventory.formatPrice(item.price) }}</strong>
        <dl class="car-specs">
          <div><dt>Year</dt><dd>{{ item.year }}</dd></div>
          <div><dt>Km</dt><dd>{{ item.mileage | number }}</dd></div>
          <div><dt>Gearbox</dt><dd>{{ item.transmission === 'Automatic' ? 'Auto' : item.transmission }}</dd></div>
          <div><dt>Fuel</dt><dd>{{ item.fuel }}</dd></div>
          <div><dt>{{ item.drive ? 'Drive' : 'Body' }}</dt><dd>{{ item.drive || item.body }}</dd></div>
          <div><dt>{{ item.engine ? 'Engine' : 'Seats' }}</dt><dd>{{ item.engine || item.seats || '—' }}</dd></div>
        </dl>
        <div class="car-actions">
          @if (item.status === 'available') {
            <a class="inquiry-button" [href]="inventory.contactLink(item)" target="_blank" rel="noopener"><app-social-icon name="whatsapp" /> Send inquiry</a>
          } @else {
            <span class="sold-note">This car has been sold</span>
          }
          <a class="details-button" [routerLink]="['/cars', item.id]">Details</a>
        </div>
      </div>
    </article>
  `,
})
export class CarCard {
  protected readonly inventory = inject(InventoryService);
  readonly car = input.required<Car>();

  protected readonly badge = computed(() => {
    const car = this.car();
    if (car.status === 'sold') return { label: 'Sold', tone: 'sold' };
    if (this.inventory.isNew(car)) return { label: 'New arrival', tone: 'new' };
    return { label: 'In stock', tone: 'stock' };
  });
}
