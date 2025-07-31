import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, Unsubscribe, collection, deleteDoc, doc, getDocs, onSnapshot } from '@angular/fire/firestore';
import { MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatIcon } from '@angular/material/icon';


@Component({
  selector: 'app-general-database',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatIcon
  ],
  templateUrl: './general-database-component.component.html',
  styleUrls: ['./general-database-component.component.scss']
})
export class GeneralDatabaseComponent implements OnInit, OnDestroy {

  private firestore: Firestore = inject(Firestore);
  private unsubscribe: Unsubscribe | null = null;
  rentals: any[] = [];
  displayedColumns: string[] = ['name', 'phone', 'embg', 'meetingDate', 'amount', 'isRentActive', 'actions'];
  paginatedData: any[] = [];
  pageSize = 5;
  pageIndex = 0;
  isLoading = true;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  async ngOnInit() {
    this.loadRentalsRealtime();
  }

  ngOnDestroy() {
    // Clean up the subscription
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  loadRentalsRealtime() {
    this.isLoading = true;

    // Set up real-time listener
    this.unsubscribe = onSnapshot(
      collection(this.firestore, 'rentals'),
      (snapshot) => {
        this.rentals = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((rental: any) => rental.isRentActive === false);

        this.updatePaginatedData();
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading rentals:', error);
        this.isLoading = false;
      }
    );
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

  // New method to calculate total amount
  getTotalAmount(): number {
    return this.rentals.reduce((total, rental) => {
      const amount = parseFloat(rental.amount) || 0;
      return total + amount;
    }, 0);
  }

  async deleteRental(rentalId: string, name: string) {
    if (confirm(`Are you sure you want to delete the rental of "${name}"?`)) {
      try {
        const rentalDocRef = doc(this.firestore, 'rentals', rentalId);
        await deleteDoc(rentalDocRef);
        // No need to manually update - the real-time listener will handle it
      } catch (error) {
        console.error('Error deleting rental:', error);
        alert('Error deleting rental. Please try again.');
      }
    }
  }

}