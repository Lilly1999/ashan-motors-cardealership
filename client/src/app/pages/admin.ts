import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { concat } from 'rxjs';
import { RouterLink } from '@angular/router';
import { InventoryService } from '../inventory.service';
import { blankCar, Car } from '../models';
import { SITE_CONFIG } from '../site-config';

@Component({
  selector: 'app-admin',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin.html',
})
export class Admin {
  protected readonly inventory = inject(InventoryService);
  protected readonly config = SITE_CONFIG;
  // Only show the development password hint when running on this computer, never on the live site.
  protected readonly isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  protected readonly loginPassword = signal('');
  protected readonly loginError = signal('');
  protected readonly adminError = signal('');
  protected readonly notice = signal('');
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal('');
  protected readonly collectionName = signal('');
  protected readonly draftImages = signal<string[]>([]);
  protected readonly imageUrl = signal('');
  protected readonly uploading = signal(false);
  protected readonly saving = signal(false);
  protected readonly pendingDeleteId = signal('');
  protected draft = blankCar('Just landed');

  constructor() {
    if (this.inventory.token()) this.inventory.load();
  }

  signIn(): void {
    this.loginError.set('');
    this.inventory.login(this.loginPassword()).subscribe({
      next: () => {
        this.loginPassword.set('');
        this.inventory.load();
      },
      error: (error: HttpErrorResponse) => this.loginError.set(error.status === 0
        ? "Can't reach the server. Make sure the API is running (npm run start:dev in the server folder)."
        : error.error?.message ?? 'Unable to sign in.'),
    });
  }

  signOut(): void {
    this.inventory.logout();
    this.formOpen.set(false);
  }

  startNewCar(): void {
    this.editingId.set('');
    this.draftImages.set([]);
    this.draft = blankCar(this.inventory.collections()[0] ?? 'Just landed');
    this.adminError.set('');
    this.formOpen.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  editCar(car: Car): void {
    const { id, createdAt, images, ...form } = car;
    this.editingId.set(id);
    this.draftImages.set([...images]);
    this.draft = { engine: '', drive: '', seats: null, color: '', ...form, newArrival: this.inventory.isNew(car) };
    this.adminError.set('');
    this.formOpen.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelCarForm(): void {
    this.formOpen.set(false);
    this.adminError.set('');
  }

  async uploadPhotos(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const originals = Array.from(input.files ?? []);
    if (!originals.length) return;
    this.uploading.set(true);
    this.adminError.set('');
    const files = await Promise.all(originals.map(shrinkPhoto));
    // One photo per request keeps each upload under Vercel's 4.5 MB request limit.
    concat(...files.map((file) => this.inventory.uploadPhotos([file]))).subscribe({
      next: ({ urls }) => this.draftImages.update((images) => [...images, ...urls]),
      complete: () => {
        this.uploading.set(false);
        input.value = '';
      },
      error: (error: HttpErrorResponse) => {
        this.uploading.set(false);
        input.value = '';
        this.handleError(error, 'A photo could not be uploaded. Each photo must be under 4 MB.');
      },
    });
  }

  addImageUrl(): void {
    const url = this.imageUrl().trim();
    if (!/^https?:\/\//i.test(url)) {
      this.adminError.set('Photo links must start with http:// or https://');
      return;
    }
    this.draftImages.update((images) => [...images, url]);
    this.imageUrl.set('');
    this.adminError.set('');
  }

  removeImage(index: number): void {
    this.draftImages.update((images) => images.filter((_, position) => position !== index));
  }

  makeCover(index: number): void {
    this.draftImages.update((images) => [images[index], ...images.filter((_, position) => position !== index)]);
  }

  saveCar(): void {
    if (!this.draftImages().length) {
      this.adminError.set('Add at least one photo.');
      return;
    }
    this.saving.set(true);
    const editing = this.editingId();
    this.inventory.saveCar(this.draft, this.draftImages(), editing || undefined).subscribe({
      next: (car) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.adminError.set('');
        this.flash(`${this.inventory.title(car)} ${editing ? 'updated' : 'added to the showroom'}.`);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.handleError(error, 'The car could not be saved. Check the details and try again.');
      },
    });
  }

  toggleSold(car: Car): void {
    this.inventory.updateFields(car, { status: car.status === 'sold' ? 'available' : 'sold' }).subscribe({
      error: (error: HttpErrorResponse) => this.handleError(error, 'The status could not be updated.'),
    });
  }

  toggleNew(car: Car): void {
    const newArrival = !this.inventory.isNew(car);
    this.inventory.updateFields(car, { newArrival }).subscribe({
      next: (updated) => this.flash(`${this.inventory.title(updated)} ${newArrival ? 'added to' : 'removed from'} New Arrivals.`),
      error: (error: HttpErrorResponse) => this.handleError(error, 'New arrival status could not be updated.'),
    });
  }

  deleteCar(car: Car): void {
    this.pendingDeleteId.set('');
    this.inventory.deleteCar(car.id).subscribe({
      next: () => this.flash(`${this.inventory.title(car)} removed.`),
      error: (error: HttpErrorResponse) => this.handleError(error, 'The car could not be removed.'),
    });
  }

  addCollection(): void {
    const name = this.collectionName().trim();
    if (!name) return;
    this.inventory.addCollection(name).subscribe({
      next: () => this.collectionName.set(''),
      error: (error: HttpErrorResponse) => this.handleError(error, 'The collection could not be added.'),
    });
  }

  removeCollection(name: string): void {
    this.inventory.removeCollection(name).subscribe({
      error: (error: HttpErrorResponse) => this.handleError(error, 'Move cars out of this collection before removing it.'),
    });
  }

  private flash(message: string): void {
    this.notice.set(message);
    setTimeout(() => this.notice.set(''), 4000);
  }

  private handleError(error: HttpErrorResponse, fallback: string): void {
    if (error.status === 401 || error.status === 403) {
      this.inventory.clearSession();
      this.formOpen.set(false);
      this.loginError.set('Your session has expired. Please sign in again.');
      return;
    }
    const message = error.error?.message;
    this.adminError.set(Array.isArray(message) ? message.join(' ') : message ?? fallback);
  }
}

const MAX_PHOTO_SIDE = 1600;

/** Downscale large photos to at most 1600px and re-encode as JPEG so uploads stay small. */
async function shrinkPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 600_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // Unsupported format in this browser: upload the original.
  }
}
