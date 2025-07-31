// src/app/guards/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, filter, take } from 'rxjs/operators';
import { AuthServiceService } from '../services/auth.service.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthServiceService);
  const router = inject(Router);

  // Wait for auth to be initialized, then check authentication
  return authService.authInitialized$.pipe(
    filter(initialized => initialized), // Wait until auth is initialized
    take(1), // Take only the first emission
    map(() => {
      if (authService.isAuthenticated()) {
        return true;
      } else {
        router.navigate(['/login']);
        return false;
      }
    })
  );
};