import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', title: 'Ashan Motors | Quality cars in Kenya', loadComponent: () => import('./pages/home').then((m) => m.Home) },
  { path: 'stock', title: 'Stock list | Ashan Motors', loadComponent: () => import('./pages/stock').then((m) => m.Stock) },
  { path: 'cars/:id', loadComponent: () => import('./pages/car-detail').then((m) => m.CarDetail) },
  { path: 'admin', title: 'Stockroom | Ashan Motors', loadComponent: () => import('./pages/admin').then((m) => m.Admin) },
  { path: '**', redirectTo: '' },
];
