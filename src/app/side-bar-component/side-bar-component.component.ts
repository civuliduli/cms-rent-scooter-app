import { Component, inject, OnInit } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Auth, signOut } from '@angular/fire/auth';
import { MatIcon } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { filter, map, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-side-bar-component',
  standalone: true,
  imports: [MatSidenavModule, RouterModule, MatIcon, CommonModule],
  templateUrl: './side-bar-component.component.html',
  styleUrl: './side-bar-component.component.scss'
})
export class SideBarComponentComponent implements OnInit {
  private auth = inject(Auth);
  private router = inject(Router);
  
  showFiller = false;
  showSidebar = false;

  ngOnInit() {
    // Check initial route and subscribe to route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      startWith({ url: this.router.url } as NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Hide sidebar for root path and login page
      this.showSidebar = event.url !== '/' && event.url !== '/login';
    });
  }

  async onLogout() {
    const confirmed = confirm('Are you sure you want to logout?');
    if (confirmed) {
      try {
        await signOut(this.auth);
        this.router.navigate(['/login']);
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  }
}