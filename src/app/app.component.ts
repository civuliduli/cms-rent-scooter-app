import { Component, inject, OnInit } from '@angular/core';
import { RouterModule, Router } from "@angular/router";
import { CommonModule } from '@angular/common';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { SideBarComponentComponent } from "./side-bar-component/side-bar-component.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, SideBarComponentComponent, CommonModule],
  template: `
    <!-- Always show sidebar component - it handles the conditional logic internally -->
    <app-side-bar-component></app-side-bar-component>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  private auth = inject(Auth);
  private router = inject(Router);
  
  isAuthenticated = false;
  currentUser: User | null = null;

  ngOnInit() {
    // Listen to authentication state changes
    onAuthStateChanged(this.auth, (user) => {
      this.isAuthenticated = !!user;
      this.currentUser = user;
      
      // Optional: You can also check the current route
      const currentUrl = this.router.url;
      if (!user && currentUrl !== '/login') {
        this.router.navigate(['/login']);
      }
    });
  }
}