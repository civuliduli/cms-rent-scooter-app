
// src/app/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { Auth, onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthServiceService {
  private auth = inject(Auth);
  private router = inject(Router);
  
  private userSubject = new BehaviorSubject<User | null>(null);
  private authInitialized = new BehaviorSubject<boolean>(false);
  
  public user$ = this.userSubject.asObservable();
  public authInitialized$ = this.authInitialized.asObservable();

  constructor() {
    // Listen to auth state changes
    onAuthStateChanged(this.auth, (user) => {
      this.userSubject.next(user);
      this.authInitialized.next(true);
    });
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.userSubject.value;
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.userSubject.value;
  }

  // Check if auth is initialized
  isAuthInitialized(): boolean {
    return this.authInitialized.value;
  }

  // Login method
  async login(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
      this.router.navigate(['/home']);
    } catch (error) {
      throw error;
    }
  }

  // Logout method
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}
