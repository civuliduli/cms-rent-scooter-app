import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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

  constructor(private cdr: ChangeDetectorRef) {
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
      .filter((rental: any) => rental.isRentActive === true) // Only show active rentals
      .map((rental: any) => {
        const scooter = this.scooters.find(s => s.id === rental.scooterId);
        return {
          ...rental,
          scooterName: rental.scooterName || (scooter ? (scooter.scooterModel || `Scooter ${scooter.id}`) : 'Unknown Scooter')
        };
      });

    // Force update the dataSource with new array reference
    this.dataSource = [...this.rentals];
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
    if (confirm(`Are you sure you want to finish the rental for ${element.name}?`)) {
      try {
        this.isSubmitting = true;

        // Update rental status
        const rentalDoc = doc(this.firestore, `rentals/${element.id}`);
        await updateDoc(rentalDoc, {
          isRentActive: false,
          finishedDate: new Date()
        });

        // Make scooter available again
        if (element.scooterId) {
          await this.updateScooterAvailability(element.scooterId, true);
        }

        console.log('Rental finished and scooter made available');
        
        // Reload data
        await this.loadScooters();
        await this.loadRentals();
        
        // Force change detection
        this.cdr.detectChanges();

        // Print completion document
        await this.printCompletionDocument(element);

        alert(`Rental for ${element.name} has been finished successfully! Scooter is now available.`);
      } catch (error) {
        console.error('Error finishing rental:', error);
        alert('Error finishing rental. Please try again.');
        this.isSubmitting = false;
      }
    }
  }

  async printCompletionDocument(rental: any) {
    try {
      if (!this.logoBase64) {
        await this.loadImageAsBase64();
      }
      if (!this.signatureBase64) {
        await this.loadSignature();
      }

      const currentDate = new Date().toLocaleDateString();
      const currentTime = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const logoImage = this.logoBase64 || '';
      const signatureImage = this.signatureBase64 || '';

      const scooter = this.scooters.find(s => s.id === rental.scooterId);
      const scooterModel = scooter
        ? scooter.scooterModel || `Scooter ${scooter.id}`
        : rental.scooterName || 'Unknown Scooter';

      const completionContent = `
        <div style="font-family: Arial, sans-serif; font-size: 13px; padding: 15px; max-width: 800px; margin: auto; line-height: 1.4;">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <div style="flex: 1;">
              <p style="font-weight: bold; font-size: 13px; margin: 0 0 6px;">CMS-2013 DOOEL DEBAR</p>
              <p style="margin: 2px 0; font-size: 12px;">Ul: "Bratstvo Edinstvo" Br.5 - Debar</p>
              <p style="margin: 2px 0; font-size: 12px;">Email: <a href="mailto:nertil.osmani@gmail.com">nertil.osmani@gmail.com</a></p>
              <p style="margin: 2px 0; font-size: 12px;">Mob: +38971211066</p>
              <p style="margin: 2px 0; font-size: 12px;">Smetka Br: 200002635881387</p>
              <p style="margin: 2px 0; font-size: 12px;">Deponent banka: "Stopanska Banka A.D - Skopje"</p>
              <p style="margin: 2px 0; font-size: 12px;">Danocen Br: 4008013501985</p>
            </div>
            <div style="flex-shrink: 0; text-align: right;">
              ${logoImage ? `<img src="${logoImage}" alt="Logo" style="height: 60px;" />` : ''}
            </div>
          </div>

          <hr style="margin: 10px 0; border: none; border-top: 2px solid #333;" />

          <h1 style="text-align: center; font-size: 20px; margin: 10px 0; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
            📋 PËRFUNDIMI I KONTRATËS
          </h1>

          <div style="font-size: 17px;">
            <p style="margin: 6px 0; text-align: justify; text-indent: 20px;">
              Pas kontrollit teknik dhe vizual nga qiradhënësi, konstatohet se trotineti elektrik është dorëzuar në gjendje të rregullt, pa dëmtime dhe me të gjithë aksesorët e marrë në momentin e marrjes me qira.
            </p>

            <p style="margin: 6px 0; text-align: justify; text-indent: 20px;">
              Qiradhënësi pranon kthimin e pajisjes dhe konfirmon mbylljen e kësaj kontrate në përputhje me të gjitha kushtet e përcaktuara në marrëveshjen fillestare.
            </p>

            <p style="margin: 6px 0 10px 0; text-align: justify; text-indent: 20px;">
              Qiramarrësit i kthehet garancia e paguar (nëse ka pasur), dhe palët deklarojnë se nuk kanë pretendime të tjera ndaj njëra-tjetrës lidhur me këtë marrëveshje dhe përdorimin e pajisjes.
            </p>

            <div style="margin: 10px 0; padding: 10px; border: 2px solid #333; background-color: #f5f5f5; font-size: 17px; border-radius: 6px;">
              <h3 style="margin: 0 0 8px; text-align: center; font-size: 20px;">📱 DETAJET E TROTINETIT</h3>
              <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                <p style="margin: 4px 0; flex: 1 0 45%; font-weight: bold;">🛴 Modeli: ${scooterModel}</p>
                <p style="margin: 4px 0; flex: 1 0 45%; font-weight: bold;">🔢 Serial: ${rental.scooterSerialNumber || 'N/A'}</p>
                <p style="margin: 4px 0; flex: 1 0 45%; font-weight: bold;">👤 Qiramarrësi: ${rental.name}</p>
                <p style="margin: 4px 0; flex: 1 0 45%; font-weight: bold;">💰 Garancia: ${rental.depositDamage || '0'} denarë</p>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin: 10px 0; font-size: 16px; background-color: #f9f9f9; padding: 8px; border-radius: 4px;">
              <p style="margin: 0; font-weight: bold;">📅 Data e dorëzimit: ${currentDate}</p>
              <p style="margin: 0; font-weight: bold;">🕒 Ora e dorëzimit: ${currentTime}</p>
            </div>

            <div style="margin: 10px 0; padding: 10px; background-color: #f0f8ff; border-left: 4px solid #333; font-size: 16px;">
              <p style="margin: 0; font-style: italic; text-align: center;">
                Ky dokument shërben si dëshmi për mbylljen e suksesshme të kontratës së qirasë dhe kthimin e pajisjes në gjendje të mirë.
              </p>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 20px; gap: 20px;">
            <div style="flex: 1; text-align: center;">
              <h3 style="margin: 0 0 10px; font-size: 15px; border-bottom: 2px solid #333; padding-bottom: 5px;">QIRADHËNËSI</h3>
              <p style="margin: 6px 0 2px; font-size: 12px; font-weight: bold;">Emri & Mbiemri:</p>
              <div style="border-bottom: 1px solid #333; height: 25px; margin: 4px 0 10px; position: relative;">
                <span style="position: absolute; top: 4px; left: 50%; transform: translateX(-50%); font-size: 11px; color: #666;">Nertil Osmani</span>
              </div>

              <p style="margin: 6px 0 2px; font-size: 12px; font-weight: bold; visibility: hidden;">Nr. ID / Pasaportë:</p>
              <div style="border-bottom: 1px solid #333; height: 25px; margin: 4px 0 10px; position: relative; visibility: hidden;">
              </div>

              <p style="margin: 6px 0 2px; font-size: 12px; font-weight: bold;">Nënshkrimi:</p>
              ${signatureImage ? `
                <div style="border: 1px solid #333; height: 60px; margin: 4px 0; display: flex; align-items: center; justify-content: center; background-color: #fafafa; border-radius: 4px;">
                  <img src="${signatureImage}" alt="Signature" style="height: 40px; max-width: 150px;" />
                </div>` :
                `<div style="border: 1px solid #333; height: 60px; margin: 4px 0; background-color: #fafafa;"></div>`}
            </div>

            <div style="flex: 1; text-align: center;">
              <h3 style="margin: 0 0 10px; font-size: 15px; border-bottom: 2px solid #333; padding-bottom: 5px;">QIRAMARRËSI</h3>
              <p style="margin: 6px 0 2px; font-size: 12px; font-weight: bold;">Emri & Mbiemri:</p>
              <div style="border-bottom: 1px solid #333; height: 25px; margin: 4px 0 10px; position: relative;">
                <span style="position: absolute; top: 4px; left: 50%; transform: translateX(-50%); font-size: 11px; color: #666;">${rental.name}</span>
              </div>

              <p style="margin: 6px 0 2px; font-size: 12px; font-weight: bold;">Nr. ID / Pasaportë:</p>
              <div style="border-bottom: 1px solid #333; height: 25px; margin: 4px 0 10px; position: relative;">
                <span style="position: absolute; top: 4px; left: 50%; transform: translateX(-50%); font-size: 11px; color: #666;">${rental.embg}</span>
              </div>

              <p style="margin: 6px 0 2px; font-size: 12px; font-weight: bold;">Nënshkrimi:</p>
              <div style="border: 1px solid #333; height: 60px; margin: 4px 0; background-color: #fafafa;"></div>
            </div>
          </div>
        </div>
      `;

      await this.executeSinglePrint(completionContent, `Completion - ${rental.name}`);
    } catch (error) {
      console.error('Error printing completion document:', error);
      alert('Error creating completion document. Please try again.');
    }
  }

private async executeSinglePrint(printContent: string, title: string): Promise<void> {
  return new Promise((resolve) => {
    // Store original page content
    const originalContent = document.body.innerHTML;
    const originalTitle = document.title;

    // Create print styles
    const printStyles = `
    <style id="print-styles-single">
      @page {
        margin: 0.5in;
        size: A4;
        @top-left { content: ""; }
        @top-center { content: ""; }
        @top-right { content: ""; }
        @bottom-left { content: ""; }
        @bottom-center { content: ""; }
        @bottom-right { content: ""; }
        @top-left-corner { content: ""; }
        @top-right-corner { content: ""; }
        @bottom-left-corner { content: ""; }
        @bottom-right-corner { content: ""; }
      }
      
      @media print {
        body {
          margin: 0;
          font-size: 14px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        header, footer, .no-print, .print-header, .print-footer {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        @page :first {
          margin-top: 0.5in;
        }
        
        img {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          max-width: 100% !important;
          height: auto !important;
          display: block !important;
        }
        
        img[alt="Logo"] {
          height: 60px !important;
          width: auto !important;
        }
        
        img[alt="Signature"] {
          height: 60px !important;
          max-width: 150px !important;
          width: auto !important;
        }
      }
      
      body { 
        font-family: Arial, sans-serif; 
        font-size: 14px; 
        margin: 0;
        padding: 20px;
      }
      
      ::-webkit-scrollbar {
        display: none;
      }
    </style>
  `;

    // Create content for ONLY ONE PAGE (for completion documents)
    const singleContent = `
    ${printStyles}
    <div class="print-container">
      ${printContent}
    </div>
  `;

    document.title = title;
    document.body.innerHTML = singleContent;

    const waitForImages = () => {
      return new Promise<void>((imageResolve) => {
        const images = document.querySelectorAll('img');
        if (images.length === 0) {
          imageResolve();
          return;
        }

        let loadedCount = 0;
        const totalImages = images.length;

        const checkAllLoaded = () => {
          loadedCount++;
          if (loadedCount >= totalImages) {
            imageResolve();
          }
        };

        images.forEach((img) => {
          if (img.complete && img.naturalHeight !== 0) {
            checkAllLoaded();
          } else {
            img.onload = checkAllLoaded;
            img.onerror = checkAllLoaded;
          }
        });

        setTimeout(() => imageResolve(), 500);
      });
    };

    // Function to restore content and resolve promise
    const restoreContentAndResolve = () => {
      document.body.innerHTML = originalContent;
      document.title = originalTitle;
      const printStyleElement = document.getElementById('print-styles-single');
      if (printStyleElement) {
        printStyleElement.remove();
      }
      // ALWAYS reset the submitting flag and resolve
      this.isSubmitting = false;
      resolve();
    };

    waitForImages().then(() => {
      setTimeout(() => {
        window.print();
      }, 100);

      const handleAfterPrint = () => {
        window.removeEventListener('afterprint', handleAfterPrint);
        restoreContentAndResolve();
      };

      window.addEventListener('afterprint', handleAfterPrint);
      setTimeout(() => {
        window.removeEventListener('afterprint', handleAfterPrint);
        restoreContentAndResolve();
      }, 5000); // Reduced timeout for faster recovery
    });
  });
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

  // Updated loadImageAsBase64 method
  async loadImageAsBase64() {
    try {
      // Try multiple paths for Netlify compatibility
      const possiblePaths = [
        './assets/cms.png',
        '/assets/cms.png',
        'assets/cms.png',
        './cms.png',
        '/cms.png',
        'cms.png'
      ];

      let response: Response | null = null;
      let successfulPath = '';

      for (const path of possiblePaths) {
        try {
          console.log(`Trying to load logo from: ${path}`);
          response = await fetch(path);
          if (response.ok) {
            successfulPath = path;
            console.log(`Successfully loaded logo from: ${path}`);
            break;
          }
        } catch (error) {
          console.log(`Failed to load from ${path}:`, error);
          continue;
        }
      }

      if (!response || !response.ok) {
        console.error('Could not load logo from any path');
        this.logoBase64 = '';
        return '';
      }

      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          this.logoBase64 = reader.result as string;
          console.log('Logo loaded successfully from:', successfulPath);
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

  // Updated loadSignature method
  async loadSignature() {
    try {
      // Try multiple paths for Netlify compatibility
      const possiblePaths = [
        './assets/signature.png',
        '/assets/signature.png',
        'assets/signature.png',
        './signature.png',
        '/signature.png',
        'signature.png'
      ];

      let response: Response | null = null;
      let successfulPath = '';

      for (const path of possiblePaths) {
        try {
          console.log(`Trying to load signature from: ${path}`);
          response = await fetch(path);
          if (response.ok) {
            successfulPath = path;
            console.log(`Successfully loaded signature from: ${path}`);
            break;
          }
        } catch (error) {
          console.log(`Failed to load from ${path}:`, error);
          continue;
        }
      }

      if (!response || !response.ok) {
        console.log('No signature found - will use default line');
        this.signatureBase64 = '';
        return '';
      }

      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          this.signatureBase64 = reader.result as string;
          console.log('Signature loaded successfully from:', successfulPath);
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
        // Set rent as active before saving
        this.form.get('isRentActive')?.patchValue(true, { emitEvent: false });

        const formData = this.form.value;
        const selectedScooter = this.scooters.find(s => s.id === formData.scooterId);

        const dataToSave = {
          ...formData,
          scooterName: selectedScooter ? (selectedScooter.scooterModel || `Scooter ${selectedScooter.id}`) : 'Unknown Scooter',
          createdAt: new Date()
        };

        console.log('Form Data to Save:', dataToSave);

        // Save the rental first
        await this.saveFormData(dataToSave);

        // Update scooter availability to false
        if (formData.scooterId) {
          await this.updateScooterAvailability(formData.scooterId, false);
        }

        // Reload data
        await this.loadScooters(); // Reload scooters to reflect availability change
        await this.loadRentals();

        alert('Form saved successfully! Scooter is now marked as unavailable.');
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

  // FIXED PRINT CONTRACT METHOD
async printContract(rental?: any) {
  // Remove the isSubmitting check at the beginning
  
  // If no rental is provided, use form data (new rental)
  const isNewRental = !rental;

  // Validate form for new rentals
  if (isNewRental && !this.form.valid) {
    this.form.markAllAsTouched();
    alert('Please fill in all required fields correctly before printing.');
    return;
  }

  this.isSubmitting = true;

  try {
    let rentalData: any;

    if (isNewRental) {
      // Create new rental from form
      this.form.get('isRentActive')?.patchValue(true, { emitEvent: false });
      const formData = this.form.value;
      const selectedScooter = this.scooters.find(s => s.id === formData.scooterId);

      rentalData = {
        ...formData,
        scooterName: selectedScooter ? (selectedScooter.scooterModel || `Scooter ${selectedScooter.id}`) : 'Unknown Scooter',
        createdAt: new Date()
      };

      // Save the rental first
      await this.saveFormData(rentalData);

      // Update scooter availability
      if (formData.scooterId) {
        await this.updateScooterAvailability(formData.scooterId, false);
      }

      // Reset form and reload data immediately
      this.resetForm();
      await this.loadScooters();
      await this.loadRentals();
    } else {
      // Use existing rental data
      rentalData = rental;
    }

    // Ensure images are loaded
    if (!this.logoBase64) {
      await this.loadImageAsBase64();
    }
    if (!this.signatureBase64) {
      await this.loadSignature();
    }

    // Format the meeting date
    const meetingDateStr = rentalData.meetingDate
      ? (rentalData.meetingDate.toDate
        ? rentalData.meetingDate.toDate().toLocaleDateString()
        : new Date(rentalData.meetingDate).toLocaleDateString())
      : '______________';

    // Format accessories - handle both array and string formats
    let accessoriesStr = 'Asnjë';
    if (rentalData.accessories) {
      if (Array.isArray(rentalData.accessories) && rentalData.accessories.length) {
        accessoriesStr = rentalData.accessories.join(', ');
      } else if (typeof rentalData.accessories === 'string' && rentalData.accessories.trim()) {
        accessoriesStr = rentalData.accessories;
      }
    }

    const currentDate = new Date().toLocaleDateString();
    const logoImage = this.logoBase64 || '';
    const signatureImage = this.signatureBase64 || '';

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
              ${logoImage ? `<img src="${logoImage}" alt="Logo" style="height: 50px;" />` : ''}
          </div>
      </div>

      <hr style="margin: 10px 0; border: none; border-top: 1px solid #ccc;" />

      <h3 style="text-align:center; font-size: 17px; margin: 15px 0 10px;">📄 KONTRATË PËR DHËNIEN ME QIRA TË TROTINETIT ELEKTRIK</h3>

      <p style="margin-top: 20px;"><strong>Qiradhënësi:</strong><br>
      Emri: CMS-2013 DOOEL DEBAR<br>
      Adresa: "Bratstvo Edinstvo" Br.5 - Debar<br>
      Nr. personal (EMBG): 4008013501985<br>
      Telefon: +38971211066</p>

      <p style="margin: 3px 0;"><strong>Qiramarrësi:</strong><br>
      Emri: ${rentalData.name}<br>
      Nr. Letërnjoftimi / Pasaportës: ${rentalData.embg}<br>
      Adresa: ${rentalData.address}<br>
      Telefon: ${rentalData.phone}</p>

      <hr style="margin: 3px 0; border: none; border-top: 1px solid #ccc;" />

      <p style="margin: 3px 0;"><strong>Neni 1 – Objekti i Kontratës</strong><br>
      Qiradhënësi i jep me qira qiramarrësit një trotinet elektrik, për përdorim të përkohshëm, sipas kushteve të kësaj kontrate.</p>

      <p style="margin: 3px 0;"><strong>Neni 2 – Periudha e Marrjes me Qira</strong><br>
      Data dhe ora e marrjes: ${meetingDateStr}<br>
      Koha totale: ${rentalData.nrOfDays || 'N/A'} ditë</p>

      <p style="margin: 3px 0;"><strong>Neni 3 – Çmimi dhe Pagesa</strong><br>
      Pagesa: para dorëzimit<br>
      Totali: ${rentalData.amount} denarë</p>

      <p style="margin: 3px 0;"><strong>Neni 4 – Depoziti</strong><br>
      Depoziti: ${rentalData.depositDamage || '0'} denarë</p>

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
              ${signatureImage ? `<img src="${signatureImage}" alt="Signature" style="height: 120px; max-width: 300px; margin: 5px 0;" />` : '<p style="margin-top: 20px;">____________________</p>'}
          </div>
          <div style="text-align: center; flex: 1;">
              <p style="margin: 5px 0;">Qiramarrësi</p>
              <p style="margin-top: 25px;">____________________</p>
          </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
          <p style="margin: 0;">📌 Nr. i trotinetit: ${rentalData.scooterSerialNumber || 'N/A'}</p>
          <p style="margin: 0;">Data: ${currentDate}</p>
      </div>
    </div>
  `;

    // Execute the print operation with proper callback handling
    await this.executePrint(printContent, isNewRental ? 'Contract' : `Contract - ${rentalData.name}`);

    // Show success message for new rentals
    if (isNewRental) {
      alert('Form saved successfully! Scooter is now marked as unavailable.');
    }

  } catch (error) {
    console.error('Error printing:', error);
    alert('Error creating print document. Please try again.');
    this.isSubmitting = false; // Reset flag on error
  }
  // The executePrint method will handle resetting isSubmitting
}

  // FIXED EXECUTE PRINT METHOD
private async executePrint(printContent: string, title: string): Promise<void> {
  return new Promise((resolve) => {
    // Store original page content
    const originalContent = document.body.innerHTML;
    const originalTitle = document.title;

    // Create print styles
    const printStyles = `
    <style id="print-styles">
      @page {
        margin: 0.5in;
        size: A4;
        @top-left { content: ""; }
        @top-center { content: ""; }
        @top-right { content: ""; }
        @bottom-left { content: ""; }
        @bottom-center { content: ""; }
        @bottom-right { content: ""; }
        @top-left-corner { content: ""; }
        @top-right-corner { content: ""; }
        @bottom-left-corner { content: ""; }
        @bottom-right-corner { content: ""; }
      }
      
      @media print {
        body {
          margin: 0;
          font-size: 9px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        header, footer, .no-print, .print-header, .print-footer {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        @page :first {
          margin-top: 0.5in;
        }
        
        @page :left {
          margin-left: 0.5in;
        }
        
        @page :right {
          margin-right: 0.5in;
        }
        
        img {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          max-width: 100% !important;
          height: auto !important;
          display: block !important;
        }
        
        img[alt="Logo"] {
          height: 50px !important;
          width: auto !important;
        }
        
        img[alt="Signature"] {
          height: 120px !important;
          max-width: 300px !important;
          width: auto !important;
        }
        
        .url-info, .page-info, .print-url {
          display: none !important;
        }
        
        .page-break {
          page-break-before: always;
        }
      }
      
      body { 
        font-family: Arial, sans-serif; 
        font-size: 9px; 
        margin: 0;
        padding: 10px;
      }
      
      ::-webkit-scrollbar {
        display: none;
      }
      
      .no-print, [class*="url"], [class*="address"], [id*="url"], [id*="address"] {
        display: none !important;
      }
    </style>
  `;

    // Create content for 2 pages
    const duplicatedContent = `
    ${printStyles}
    <div class="print-container">
      ${printContent}
    </div>
    <div class="print-container page-break">
      ${printContent}
    </div>
  `;

    // Replace page content temporarily
    document.title = title;
    document.body.innerHTML = duplicatedContent;

    // Wait for images to load
    const waitForImages = () => {
      return new Promise<void>((imageResolve) => {
        const images = document.querySelectorAll('img');
        if (images.length === 0) {
          imageResolve();
          return;
        }

        let loadedCount = 0;
        const totalImages = images.length;

        const checkAllLoaded = () => {
          loadedCount++;
          if (loadedCount >= totalImages) {
            imageResolve();
          }
        };

        images.forEach((img) => {
          if (img.complete && img.naturalHeight !== 0) {
            checkAllLoaded();
          } else {
            img.onload = checkAllLoaded;
            img.onerror = checkAllLoaded;
          }
        });

        setTimeout(() => imageResolve(), 500);
      });
    };

    // Function to restore content and resolve promise
    const restoreContentAndResolve = () => {
      document.body.innerHTML = originalContent;
      document.title = originalTitle;
      const printStyleElement = document.getElementById('print-styles');
      if (printStyleElement) {
        printStyleElement.remove();
      }
      
      // ALWAYS reset the submitting flag and resolve
      this.isSubmitting = false;
      resolve();
    };

    // Wait for images and then execute print
    waitForImages().then(() => {
      setTimeout(() => {
        window.print();
      }, 100);

      // Handle after print events
      const handleAfterPrint = () => {
        window.removeEventListener('afterprint', handleAfterPrint);
        restoreContentAndResolve();
      };

      // Listen for print completion
      window.addEventListener('afterprint', handleAfterPrint);

      // Fallback timeout - ALWAYS restore after 5 seconds
      setTimeout(() => {
        window.removeEventListener('afterprint', handleAfterPrint);
        restoreContentAndResolve();
      }, 5000); // Reduced from 10000 to 5000 for faster recovery
    });
  });
}

  getAvailableScootersCount(): number {
    return this.scooters.filter(scooter => scooter.isScooterAvailable !== false).length;
  }

  async updateScooterAvailability(scooterId: string, isAvailable: boolean) {
    try {
      const scooterDoc = doc(this.firestore, 'scooters', scooterId);
      await updateDoc(scooterDoc, {
        isScooterAvailable: isAvailable,
        updatedAt: new Date()
      });
      console.log(`Scooter ${scooterId} availability updated to: ${isAvailable}`);
    } catch (error) {
      console.error('Error updating scooter availability:', error);
      throw error;
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