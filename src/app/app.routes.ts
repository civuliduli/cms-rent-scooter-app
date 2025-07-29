import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  // Redirect to login by default
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  
  // Login route (no authentication required)
  {
    path: 'login',
    loadComponent: () => {
      return import('./login/login.component').then((m) => m.LoginComponent)
    }
  },
  
  // Protected routes (require authentication)
  {
    path: 'home',
    loadComponent: () => {
      return import('./home-component/home-component.component').then((m) => m.HomeComponentComponent)
    },
    canActivate: [authGuard]
  },
  
  {
    path: 'registerScooters',
    loadComponent: () => {
      return import('./register-scooter-component/register-scooter-component.component').then((m) => m.RegisterScooterComponentComponent)
    },
    canActivate: [authGuard]
  },
  
  {
    path: 'generalDatabase',
    loadComponent: () => {
      return import('./general-database-component/general-database-component.component').then((m) => m.GeneralDatabaseComponent)
    },
    canActivate: [authGuard]
  },
  
  // Wildcard route - redirect to login for unknown routes
  {
    path: '**',
    redirectTo: '/login'
  }
];