import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormGroup,
  FormControl,
  Validators,
  FormArray,
  ValidatorFn,
  AbstractControl,
  ReactiveFormsModule
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { Firestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from '@angular/fire/firestore';
import { inject } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';
import { MatChip } from '@angular/material/chips';

@Component({
  selector: 'app-home-component',
  standalone: true,
  templateUrl: './home-component.component.html',
  styleUrls: ['./home-component.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatChip
  ]
})
export class HomeComponentComponent implements OnInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private destroy$ = new Subject<void>();

  logoBase64 = '';
  signatureBase64 = ''; // Added signature storage
  accessoriess = ['Helmet', 'Charger'];
  rentals: any[] = [];
  displayedColumns: string[] = ['name', 'phone', 'embg', 'meetingDate', 'address', 'amount', 'scooter', 'scooterSerialNr', 'priceOfScooter', 'actions'];
  dataSource = this.rentals;
  isLoading = false;
  scooters: any[] = [];
  isSubmitting = false;
  isInitialized = false;

  form = new FormGroup({
    name: new FormControl('', Validators.required),
    phone: new FormControl('', [
      Validators.required,
      Validators.pattern('^[0-9]*$')
    ]),
    email: new FormControl('', [Validators.required, Validators.email]),
    embg: new FormControl('', [
      Validators.required,
      Validators.pattern('^[0-9]*$')
    ]),
    meetingDate: new FormControl(new Date(), Validators.required),
    nrOfDays: new FormControl('', [
      Validators.required,
      Validators.pattern('^[0-9]*$')
    ]),
    depositDamage: new FormControl('', [
      Validators.required,
      Validators.pattern('^[0-9]*$')
    ]),
    accessories: new FormArray([], this.minSelectedCheckboxes(1)),
    amount: new FormControl('', [
      Validators.required,
      Validators.pattern('^[0-9]*$')
    ]),
    scooterSerialNumber: new FormControl('', Validators.required),
    isRentActive: new FormControl(false),
    scooterId: new FormControl('', Validators.required),
    address: new FormControl('', [
      Validators.required,
    ]),
    priceOfScooter: new FormControl('', [
      Validators.required,
      Validators.pattern('^[0-9]*$')
    ])

  });

  constructor() {
    // Remove async operations from constructor
  }

  async ngOnInit() {
    try {
      this.isLoading = true;

      // Load data first
      await this.loadImageAsBase64();
      await this.loadSignature(); // Load signature
      await this.loadScooters();
      await this.loadRentals();

      // Setup subscriptions only after data is loaded
      this.setupFormSubscriptions();
      this.isInitialized = true;

    } catch (error) {
      console.error('Error initializing component:', error);
    } finally {
      this.isLoading = false;
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Replace your existing setupFormSubscriptions() method with this updated version:

  private setupFormSubscriptions() {
    // Use takeUntil to prevent memory leaks and ensure subscriptions are cleaned up
    this.form.get('scooterId')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(selectedId => {
        if (this.isInitialized) {
          const selectedScooter = this.scooters.find(s => s.id === selectedId);
          if (selectedScooter) {
            this.form.patchValue({
              scooterSerialNumber: selectedScooter.scooterSerialNumber || ''
            }, { emitEvent: false });
            this.form.patchValue({
              priceOfScooter: selectedScooter.pricePerModel || ''
            }, { emitEvent: false });

            // Calculate amount based on scooter price and number of days
            this.calculateAmount();
          } else {
            this.form.patchValue({
              scooterSerialNumber: '',
              priceOfScooter: ''
            }, { emitEvent: false });
          }
        }
      });

    // Fix the date calculation to prevent infinite loops
    this.form.get('meetingDate')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(selectedDate => {
        if (this.isInitialized && selectedDate) {
          const today = new Date();
          const selected = new Date(selectedDate);
          today.setHours(0, 0, 0, 0);
          selected.setHours(0, 0, 0, 0);
          const dayDiff = Math.ceil((selected.getTime() - today.getTime()) / (1000 * 3600 * 24));

          // Use patchValue with emitEvent: false to prevent recursive calls
          this.form.get('nrOfDays')?.patchValue((dayDiff >= 0 ? dayDiff : 0).toString(), { emitEvent: false });

          // Recalculate amount when days change
          this.calculateAmount();
        }
      });

    // Add subscription for manual changes to nrOfDays
    this.form.get('nrOfDays')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isInitialized) {
          this.calculateAmount();
        }
      });

    // Add subscription for manual changes to priceOfScooter
    this.form.get('priceOfScooter')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isInitialized) {
          this.calculateAmount();
        }
      });
  }

  // Add this new method to handle amount calculation
  private calculateAmount() {
    const nrOfDays = parseInt(this.form.get('nrOfDays')?.value || '0');
    const priceOfScooter = parseInt(this.form.get('priceOfScooter')?.value || '0');

    if (nrOfDays > 0 && priceOfScooter > 0) {
      const totalAmount = nrOfDays * priceOfScooter;
      this.form.patchValue({
        amount: totalAmount.toString()
      }, { emitEvent: false });
    } else {
      this.form.patchValue({
        amount: ''
      }, { emitEvent: false });
    }
  }

  async loadScooters() {
    try {
      const scootersSnapshot = await getDocs(collection(this.firestore, 'scooters'));
      this.scooters = scootersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Loaded scooters:', this.scooters);
    } catch (error) {
      console.error('Error loading scooters:', error);
      throw error;
    }
  }

  async loadRentals() {
    try {
      const rentalsSnapshot = await getDocs(collection(this.firestore, 'rentals'));
      this.rentals = rentalsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((rental: any) => rental.isRentActive === true)
        .map((rental: any) => {
          const scooter = this.scooters.find(s => s.id === rental.scooterId);
          return {
            ...rental,
            scooterName: rental.scooterName || (scooter ? (scooter.scooterModel || `Scooter ${scooter.id}`) : 'Unknown Scooter')
          };
        });

      this.dataSource = this.rentals;
      console.log('Loaded rentals:', this.rentals);
    } catch (error) {
      console.error('Error loading rentals:', error);
      throw error;
    }
  }

  async toggleActive(element: any) {
    if (this.isSubmitting) return; // Prevent multiple clicks

    try {
      this.isSubmitting = true;
      const rentalDoc = doc(this.firestore, `rentals/${element.id}`);
      await updateDoc(rentalDoc, {
        isRentActive: !element.isRentActive
      });
      console.log('Rental status updated');
      await this.loadRentals();
    } catch (error) {
      console.error('Error updating rental status:', error);
      alert('Error updating rental status. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }

  async finishRental(element: any) {
    if (this.isSubmitting) return; // Prevent multiple clicks

    if (confirm(`Are you sure you want to finish the rental for ${element.name}?`)) {
      try {
        this.isSubmitting = true;
        const rentalDoc = doc(this.firestore, `rentals/${element.id}`);
        await updateDoc(rentalDoc, {
          isRentActive: false,
          finishedDate: new Date()
        });
        console.log('Rental finished');
        await this.loadRentals();
        alert(`Rental for ${element.name} has been finished successfully!`);
      } catch (error) {
        console.error('Error finishing rental:', error);
        alert('Error finishing rental. Please try again.');
      } finally {
        this.isSubmitting = false;
      }
    }
  }

  minSelectedCheckboxes(min = 1): ValidatorFn {
    return (formArray: AbstractControl) => {
      const totalSelected = (formArray as FormArray).controls
        .map(control => control.value)
        .filter(value => value).length;
      return totalSelected >= min ? null : { required: true };
    };
  }

  onCheckboxChange(event: any) {
    const accessoriesArray = this.form.get('accessories') as FormArray;
    if (event.target.checked) {
      accessoriesArray.push(new FormControl(event.target.value));
    } else {
      const index = accessoriesArray.controls.findIndex(control => control.value === event.target.value);
      if (index !== -1) accessoriesArray.removeAt(index);
    }
    accessoriesArray.markAsTouched();
    accessoriesArray.updateValueAndValidity();
  }

  async loadImageAsBase64() {
    try {
      // Since your images are in public/ folder, they'll be at the root after build
      const response = await fetch('/cms.png');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          this.logoBase64 = reader.result as string;
          console.log('Logo loaded successfully');
          resolve(this.logoBase64);
        };
        reader.onerror = (error) => {
          console.error('FileReader error:', error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error loading image:', error);
      this.logoBase64 = '';
      return '';
    }
  }

  // Load signature from public folder
  async loadSignature() {
    try {
      // Since your signature is in public/ folder, it'll be at the root after build
      const response = await fetch('/signature.png');
      if (!response.ok) {
        console.log('No signature found - will use default line');
        return;
      }

      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          this.signatureBase64 = reader.result as string;
          console.log('Signature loaded successfully');
          resolve(this.signatureBase64);
        };
        reader.onerror = (error) => {
          console.error('FileReader error:', error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error loading signature:', error);
      this.signatureBase64 = '';
      return '';
    }
  }

  async saveFormData(formData: any) {
    try {
      const rentalsCollection = collection(this.firestore, 'rentals');
      const docRef = await addDoc(rentalsCollection, formData);
      console.log('Data saved to Firebase with ID:', docRef.id);
      return docRef;
    } catch (error) {
      console.error('Error saving data:', error);
      throw error;
    }
  }

  async toggleRentStatus(rental: any) {
    if (this.isSubmitting) return; // Prevent multiple clicks

    try {
      this.isSubmitting = true;
      const rentalDoc = doc(this.firestore, 'rentals', rental.id);
      await updateDoc(rentalDoc, { isRentActive: !rental.isRentActive });
      await this.loadRentals();
    } catch (error) {
      console.error('Error toggling rent status:', error);
      alert('Error updating rental status. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }

  async deleteRental(rentalId: string) {
    if (this.isSubmitting) return; // Prevent multiple clicks

    if (confirm('Are you sure you want to delete this rental?')) {
      try {
        this.isSubmitting = true;
        await deleteDoc(doc(this.firestore, 'rentals', rentalId));
        await this.loadRentals();
        alert('Rental deleted successfully!');
      } catch (error) {
        console.error('Error deleting rental:', error);
        alert('Error deleting rental. Please try again.');
      } finally {
        this.isSubmitting = false;
      }
    }
  }

  async onSubmit() {
    if (this.form.valid && !this.isSubmitting) {
      this.isSubmitting = true;

      try {
        // Set rent as active before saving (same as print method)
        this.form.get('isRentActive')?.patchValue(true, { emitEvent: false });

        const formData = this.form.value;

        const selectedScooter = this.scooters.find(s => s.id === formData.scooterId);
        const dataToSave = {
          ...formData,
          scooterName: selectedScooter ? (selectedScooter.scooterModel || `Scooter ${selectedScooter.id}`) : 'Unknown Scooter',
          createdAt: new Date()
        };

        console.log('Form Data to Save:', dataToSave);
        await this.saveFormData(dataToSave);

        // Only reload once after successful save
        await this.loadRentals();

        alert('Form saved successfully!');
        this.resetForm();
      } catch (error) {
        console.error('Error submitting form:', error);
        alert('Error saving form. Please try again.');
      } finally {
        this.isSubmitting = false;
      }
    } else if (!this.form.valid) {
      this.form.markAllAsTouched();
      alert('Please fill in all required fields correctly.');
    }
  }

  private resetForm() {
    this.form.reset();
    this.form.get('meetingDate')?.setValue(new Date());
    this.form.get('isRentActive')?.setValue(false);

    // Reset accessories FormArray
    const accessoriesArray = this.form.get('accessories') as FormArray;
    while (accessoriesArray.length !== 0) {
      accessoriesArray.removeAt(0);
    }
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox: any) => {
      checkbox.checked = false;
    });
  }

  async onPrint() {
    if (this.form.valid && !this.isSubmitting) {
      this.isSubmitting = true;

      try {
        // Set rent as active before saving
        this.form.get('isRentActive')?.patchValue(true, { emitEvent: false });

        if (!this.logoBase64) {
          await this.loadImageAsBase64();
        }

        const formData = this.form.value;

        const selectedScooter = this.scooters.find(s => s.id === formData.scooterId);
        const dataToSave = {
          ...formData,
          scooterName: selectedScooter ? (selectedScooter.scooterModel || `Scooter ${selectedScooter.id}`) : 'Unknown Scooter',
          createdAt: new Date()
        };

        // Save the data first
        await this.saveFormData(dataToSave);

        const meetingDateStr = formData.meetingDate
          ? new Date(formData.meetingDate).toLocaleDateString()
          : '______________';

        const accessoriesStr = Array.isArray(formData.accessories) && formData.accessories.length
          ? formData.accessories.join(', ')
          : 'Asnjë';

        const currentDate = new Date().toLocaleDateString();

        const printContent = `
        <div style="font-family: Arial, sans-serif; font-size: 15px; padding: 5px; max-width: 800px; margin: auto; line-height: 1.1;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3px;">
          <div style="flex: 1;">
              <p style="font-weight: bold; font-size: 9px; margin: 0; padding: 0;">CMS-2013 DOOEL DEBAR</p>
              <p style="margin: 0; padding: 0;">Ul: "Bratstvo Edinstvo" Br.5 - Debar</p>
              <p style="margin: 0; padding: 0;">Email: <a href="mailto:nertil.osmani@gmail.com">nertil.osmani@gmail.com</a></p>
              <p style="margin: 0; padding: 0;">Mob: +38971211066</p>
              <p style="margin: 0; padding: 0;">Smetka Br: 200002635881387</p>
              <p style="margin: 0; padding: 0;">Deponent banka: "Stopanska Banka A.D - Skopje"</p>
              <p style="margin: 0; padding: 0;">Danocen Br: 4008013501985</p>
          </div>
          <div style="flex-shrink: 0; text-align: right;">
              ${this.logoBase64 ? `<img src="${this.logoBase64}" alt="Logo" style="height: 50px;" />` : ''}
          </div>
      </div>

      <hr style="margin: 3px 0; border: none; border-top: 1px solid #ccc;" />

      <h3 style="text-align:center; font-size: 17px; margin: 5px 0;">📄 KONTRATË PËR DHËNIEN ME QIRA TË TROTINETIT ELEKTRIK</h3>

      <p style="margin: 3px 0;"><strong>Qiradhënësi:</strong><br>
      Emri: CMS-2013 DOOEL DEBAR<br>
      Adresa: "Bratstvo Edinstvo" Br.5 - Debar<br>
      Nr. personal (EMBG): 4008013501985<br>
      Telefon: +38971211066</p>

      <p style="margin: 3px 0;"><strong>Qiramarrësi:</strong><br>
      Emri: ${formData.name}<br>
      Nr. Letërnjoftimi / Pasaportës: ${formData.embg}<br>
      Adresa: ${formData.address}<br>
      Telefon: ${formData.phone}</p>

      <hr style="margin: 3px 0; border: none; border-top: 1px solid #ccc;" />

      <p style="margin: 3px 0;"><strong>Neni 1 – Objekti i Kontratës</strong><br>
      Qiradhënësi i jep me qira qiramarrësit një trotinet elektrik, për përdorim të përkohshëm, sipas kushteve të kësaj kontrate.</p>

      <p style="margin: 3px 0;"><strong>Neni 2 – Periudha e Marrjes me Qira</strong><br>
      Data dhe ora e marrjes: ${meetingDateStr}<br>
      Koha totale: ${formData.nrOfDays} ditë</p>

      <p style="margin: 3px 0;"><strong>Neni 3 – Çmimi dhe Pagesa</strong><br>
      Pagesa: para dorëzimit<br>
      Totali: ${formData.amount} denarë</p>

      <p style="margin: 3px 0;"><strong>Neni 4 – Depoziti</strong><br>
      Depoziti: ${formData.depositDamage || '0'} denarë</p>

      <p style="margin: 3px 0;"><strong>Neni 5 – Detyrimet e Qiramarrësit</strong><br>
      1. ⁠E përdor trotinetin me kujdes dhe në përputhje me rregullat e trafikut.<br>
      2. ⁠Është përgjegjës për çdo dëmtim, humbje ose vjedhje të trotinetit gjatë periudhës së përdorimit.<br>
      3. ⁠Në rast aksidenti ose problemi, e njofton menjëherë qiradhënësin.<br>
      4. Nuk e jep trotinetin palës së tretë pa leje me shkrim.</p>

      <p style="margin: 3px 0;"><strong>Neni 6 – Dorëzimi dhe Kontrolli</strong><br>
      Aksesorë: ${accessoriesStr}</p>

      <p style="margin: 3px 0;"><strong>Neni 7 – Zgjidhja e Mosmarrëveshjeve</strong><br>
      Mosmarrëveshjet zgjidhen në Gjykatën Themelore në Dibër.</p>

      <p style="margin: 3px 0;"><strong>Neni 8 – Dispozita përfundimtare</strong><br>
      Kontrata në 2 kopje. Nënshkrimi nënkupton pranimin e kushteve.</p>

<hr style="margin: 3px 0; border: none; border-top: 1px solid #ccc;" />

<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 5px;">
    <div style="text-align: center; flex: 1;">
        <p style="margin: 5px 0;">Qiradhënësi</p>
        ${this.signatureBase64 ? `<img src="${this.signatureBase64}" alt="Signature" style="height: 120px; max-width: 300px; margin: 5px 0;" />` : '<p style="margin-top: 20px;">____________________</p>'}
    </div>
    <div style="text-align: center; flex: 1;">
        <p style="margin: 5px 0;">Qiramarrësi</p>
        <p style="margin-top: 25px;">____________________</p>
    </div>
</div>

<div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
    <p style="margin: 0;">📌 Nr. i trotinetit: ${formData.scooterSerialNumber}</p>
    <p style="margin: 0;">Data: ${currentDate}</p>
</div>
  </div>
    `;

        // Reset form and reload data immediately (before opening print dialog)
        this.resetForm();
        await this.loadRentals();

        // Create print window with enhanced CSS to hide headers/footers
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Contract</title>
            <style>
              @page {
                margin: 0.5in;
                size: A4;
                /* Hide headers and footers */
                @top-left { content: ""; }
                @top-center { content: ""; }
                @top-right { content: ""; }
                @bottom-left { content: ""; }
                @bottom-center { content: ""; }
                @bottom-right { content: ""; }
              }
              
              @media print {
                body {
                  margin: 0;
                  font-size: 9px;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                
                /* Hide any potential header/footer elements */
                header, footer, .no-print {
                  display: none !important;
                }
                
                /* Ensure content fits properly */
                * {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
              
              body { 
                font-family: Arial, sans-serif; 
                font-size: 9px; 
                margin: 0;
                padding: 10px;
              }
              
              /* Hide scrollbars */
              ::-webkit-scrollbar {
                display: none;
              }
            </style>
          </head>
          <body>${printContent}</body>
        </html>
      `);
          printWindow.document.close();

          // Set up event listeners for print window
          const handlePrintWindowEvents = () => {
            // Auto-close the print window after a delay if user doesn't interact
            const autoCloseTimer = setTimeout(() => {
              if (!printWindow.closed) {
                printWindow.close();
              }
            }, 30000); // 30 seconds timeout

            // Listen for window close
            const checkClosed = setInterval(() => {
              if (printWindow.closed) {
                clearInterval(checkClosed);
                clearTimeout(autoCloseTimer);
              }
            }, 1000);

            // Listen for print events in the new window
            printWindow.onbeforeprint = () => {
              clearTimeout(autoCloseTimer);
            };

            printWindow.onafterprint = () => {
              setTimeout(() => {
                if (!printWindow.closed) {
                  printWindow.close();
                }
              }, 1000);
            };
          };

          // Wait for content to load then setup print and event handling
          setTimeout(() => {
            handlePrintWindowEvents();
            printWindow.print();
          }, 500);
        }

      } catch (error) {
        console.error('Error printing:', error);
        alert('Error creating print document. Please try again.');
      } finally {
        // Always reset isSubmitting, regardless of what happens with the print window
        this.isSubmitting = false;
      }
    } else if (!this.form.valid) {
      this.form.markAllAsTouched();
      alert('Please fill in all required fields correctly before printing.');
    }
  }

  allowOnlyNumbers(event: KeyboardEvent): void {
    const charCode = event.key.charCodeAt(0);
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }

  /**
   * Get the CSS class for date cell based on due date comparison
   */
  getDateCellClass(meetingDate: any): string {
    if (!meetingDate) return '';

    const today = new Date();
    const dueDate = meetingDate.toDate ? meetingDate.toDate() : new Date(meetingDate);

    // Reset time to compare only dates
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const timeDiff = dueDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysDiff < 0) {
      // Overdue - red background
      return 'overdue-date';
    } else if (daysDiff === 0) {
      // Due today - yellow background
      return 'due-tomorrow';
    } else if (daysDiff === 1) {
      // Due tomorrow - yellow background
      return 'due-tomorrow';
    }

    return '';
  }

  /**
   * Get the CSS class for the entire row based on due date
   */
  getRowClass(element: any): string {
    if (!element.meetingDate) return '';

    const today = new Date();
    const dueDate = element.meetingDate.toDate ? element.meetingDate.toDate() : new Date(element.meetingDate);

    // Reset time to compare only dates
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const timeDiff = dueDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysDiff < 0) {
      return 'overdue-row';
    } else if (daysDiff === 0 || daysDiff === 1) {
      return 'due-tomorrow-row';
    }

    return '';
  }

}