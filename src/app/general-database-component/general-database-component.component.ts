import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'app-general-database',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatChipsModule
  ],
  templateUrl: './general-database-component.component.html', // <-- fix here
  styleUrls: ['./general-database-component.component.scss']   // <-- fix here if needed
})
export class GeneralDatabaseComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  rentals: any[] = [];
displayedColumns: string[] = ['name', 'phone', 'embg', 'meetingDate', 'amount', 'isRentActive'];
  paginatedData: any[] = [];
  pageSize = 5;
  pageIndex = 0;
  isLoading = true;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  async ngOnInit() {
    await this.loadRentals();
  }

async loadRentals() {
  try {
    const rentalsSnapshot = await getDocs(collection(this.firestore, 'rentals'));
    this.rentals = rentalsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((rental: any) => rental.isRentActive === false); // 👈 Only finished rentals

    this.updatePaginatedData();
    this.isLoading = false;
  } catch (error) {
    console.error('Error loading rentals:', error);
    this.isLoading = false;
  }
}

  updatePaginatedData() {
    const startIndex = this.pageIndex * this.pageSize;
    this.paginatedData = this.rentals.slice(startIndex, startIndex + this.pageSize);
  }

  onPageChange(event: any) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePaginatedData();
  }
  formatMeetingDate(date: any): string {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : date;
  return new Date(d).toLocaleDateString();
}
}


