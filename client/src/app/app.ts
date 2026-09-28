import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { InventoryService } from './inventory.service';
import { SITE_CONFIG } from './site-config';
import { SocialIcon, SocialNetwork } from './social-icon';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SocialIcon],
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  protected readonly inventory = inject(InventoryService);
  protected readonly config = SITE_CONFIG;
  protected readonly year = new Date().getFullYear();
  protected readonly menuOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd), map((event) => event.urlAfterRedirects)),
    { initialValue: this.router.url },
  );
  protected readonly isAdmin = computed(() => this.url().startsWith('/admin'));

  protected readonly socials = computed(() => ([
    { network: 'whatsapp' as SocialNetwork, label: 'WhatsApp', url: this.inventory.contactLink() },
    { network: 'instagram' as SocialNetwork, label: 'Instagram', url: SITE_CONFIG.instagramUrl },
    { network: 'tiktok' as SocialNetwork, label: 'TikTok', url: SITE_CONFIG.tiktokUrl },
    { network: 'youtube' as SocialNetwork, label: 'YouTube', url: SITE_CONFIG.youtubeUrl },
  ]).filter((item) => item.url));

  constructor() {
    let previousPath = this.router.url.split(/[?#]/)[0];
    effect(() => {
      const [path] = this.url().split(/[?#]/);
      if (path !== previousPath && !this.url().includes('#')) window.scrollTo({ top: 0 });
      previousPath = path;
      this.menuOpen.set(false);
    });
    effect(() => {
      document.body.style.overflow = this.menuOpen() ? 'hidden' : '';
    });
  }
}
