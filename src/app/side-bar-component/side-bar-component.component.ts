import { Component, inject } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterModule, Router } from '@angular/router';
import { Auth, signOut } from '@angular/fire/auth';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-side-bar-component',
  standalone: true,
  imports: [MatSidenavModule, RouterModule, MatIcon],
  templateUrl: './side-bar-component.component.html',
  styleUrl: './side-bar-component.component.scss'
})
export class SideBarComponentComponent {
  private auth = inject(Auth);
  private router = inject(Router);
  
  showFiller = false;

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