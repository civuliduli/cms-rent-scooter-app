import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Firestore, collection, addDoc, collectionData, doc, deleteDoc } from '@angular/fire/firestore';

interface Scooter {
  id?: string;
  scooterModel: string;
  scooterSerialNumber: string;
  scooterQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

@Component({
  selector: 'app-register-scooter-component',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './register-scooter-component.component.html',
  styleUrl: './register-scooter-component.component.scss'
})
export class RegisterScooterComponentComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  
  scooters: Scooter[] = [];
  displayedColumns: string[] = ['scooterModel', 'scooterSerialNumber', 'scooterQuantity', 'createdAt', 'actions'];
  isLoading = false;

  // Updated form to match your HTML template
  form = new FormGroup({
    scooterModel: new FormControl('', Validators.required),
    scooterSerialNumber: new FormControl('', Validators.required),
    scooterQuantity: new FormControl('', [
      Validators.required,
      Validators.pattern('^[0-9]*$'),
      Validators.min(1)
    ]),
  });

  ngOnInit() {
    this.loadScooters();
  }

  // Load scooters from Firebase
  loadScooters() {
    this.isLoading = true;
    const scootersCollection = collection(this.firestore, 'scooters');
    
    collectionData(scootersCollection, { idField: 'id' }).subscribe({
      next: (data: any[]) => {
        this.scooters = data.map(scooter => ({
          ...scooter,
          createdAt: scooter.createdAt?.toDate ? scooter.createdAt.toDate() : new Date(scooter.createdAt),
          updatedAt: scooter.updatedAt?.toDate ? scooter.updatedAt.toDate() : new Date(scooter.updatedAt)
        }));
        this.isLoading = false;
        console.log('Loaded scooters:', this.scooters);
      },
      error: (error) => {
        console.error('Error loading scooters:', error);
        this.isLoading = false;
      }
    });
  }

  // Save scooter data to Firebase
  async saveScooterData(formData: any) {
    try {
      console.log('Attempting to save scooter:', formData);
      const scootersCollection = collection(this.firestore, 'scooters');
      const docRef = await addDoc(scootersCollection, {
        ...formData,
        scooterQuantity: parseInt(formData.scooterQuantity),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Scooter registered with ID: ', docRef.id);
      console.log('Scooter data saved to Firebase');
      return docRef.id;
    } catch (error: any) {
      console.error('Error saving scooter data:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      throw error;
    }
  }

  // Delete scooter from Firebase
  async deleteScooter(scooterId: string, scooterModel: string) {
    if (confirm(`Are you sure you want to delete the scooter "${scooterModel}"?`)) {
      try {
        const scooterDocRef = doc(this.firestore, 'scooters', scooterId);
        await deleteDoc(scooterDocRef);
        console.log('Scooter deleted successfully');
        // The table will automatically update due to the real-time subscription
      } catch (error) {
        console.error('Error deleting scooter:', error);
        alert('Error deleting scooter. Please try again.');
      }
    }
  }

  async onSubmit() {
    if (this.form.valid) {
      try {
        const formData = this.form.value;
        console.log('Form Data:', formData);
        // Save to Firebase
        const docId = await this.saveScooterData(formData);
        alert(`Scooter registered successfully! ID: ${docId}`);
        // Reset form after successful save
        this.form.reset();
      } catch (error) {
        alert('Error registering scooter. Please try again.');
      }
    } else {
      this.form.markAllAsTouched();
      alert('Please fill in all required fields correctly.');
    }
  }

  allowOnlyNumbers(event: KeyboardEvent): void {
    const charCode = event.key.charCodeAt(0);
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }
}