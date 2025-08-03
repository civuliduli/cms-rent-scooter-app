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
  signatureBase64 = '';
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

      // Pre-load assets with retry mechanism
      await this.preloadAssetsWithRetry();
      
      await this.loadScooters();
      await this.loadRentals();

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

  // NEW: Pre-load assets with retry mechanism
  async preloadAssetsWithRetry(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Asset loading attempt ${attempt}/${maxRetries}`);
        
        // Load both assets concurrently
        const [logoResult, signatureResult] = await Promise.allSettled([
          this.loadImageAsBase64(),
          this.loadSignature()
        ]);

        // Check if logo loaded successfully
        if (logoResult.status === 'fulfilled' && this.logoBase64) {
          console.log('✅ Logo loaded successfully');
        } else {
          console.log(`❌ Logo failed on attempt ${attempt}`);
          if (attempt < maxRetries) {
            await this.delay(1000 * attempt); // Progressive delay
            continue;
          }
        }

        // Check if signature loaded successfully
        if (signatureResult.status === 'fulfilled') {
          console.log('✅ Signature loaded successfully');
        } else {
          console.log(`❌ Signature failed on attempt ${attempt}`);
        }

        // If we got the logo (signature is optional), we're good
        if (this.logoBase64) {
          break;
        }

      } catch (error) {
        console.error(`Asset loading attempt ${attempt} failed:`, error);
        if (attempt < maxRetries) {
          await this.delay(1000 * attempt);
        }
      }
    }
  }

  // NEW: Delay utility
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private setupFormSubscriptions() {
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

            this.calculateAmount();
          } else {
            this.form.patchValue({
              scooterSerialNumber: '',
              priceOfScooter: ''
            }, { emitEvent: false });
          }
        }
      });

    this.form.get('meetingDate')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(selectedDate => {
        if (this.isInitialized && selectedDate) {
          const today = new Date();
          const selected = new Date(selectedDate);
          today.setHours(0, 0, 0, 0);
          selected.setHours(0, 0, 0, 0);
          const dayDiff = Math.ceil((selected.getTime() - today.getTime()) / (1000 * 3600 * 24));

          this.form.get('nrOfDays')?.patchValue((dayDiff >= 0 ? dayDiff : 0).toString(), { emitEvent: false });
          this.calculateAmount();
        }
      });

    this.form.get('nrOfDays')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isInitialized) {
          this.calculateAmount();
        }
      });

    this.form.get('priceOfScooter')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isInitialized) {
          this.calculateAmount();
        }
      });
  }

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

      this.dataSource = [...this.rentals];
      console.log('Loaded rentals:', this.rentals);
    } catch (error) {
      console.error('Error loading rentals:', error);
      throw error;
    }
  }

  async toggleActive(element: any) {
    if (this.isSubmitting) return;

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

        const rentalDoc = doc(this.firestore, `rentals/${element.id}`);
        await updateDoc(rentalDoc, {
          isRentActive: false,
          finishedDate: new Date()
        });

        if (element.scooterId) {
          await this.updateScooterAvailability(element.scooterId, true);
        }

        console.log('Rental finished and scooter made available');
        
        await this.loadScooters();
        await this.loadRentals();
        
        this.cdr.detectChanges();

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
      // MODIFIED: Force reload assets if missing
      if (!this.logoBase64 || !this.signatureBase64) {
        console.log('🔄 Assets missing for completion document, forcing reload...');
        await this.loadImageAsBase64();
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
              ${logoImage ? `<img src="${logoImage}" alt="Logo" style="height: 60px;" />` : '<div style="height: 60px; width: 100px; border: 2px solid red; display: flex; align-items: center; justify-content: center; font-size: 10px;">LOGO MISSING</div>'}
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
      const originalContent = document.body.innerHTML;
      const originalTitle = document.title;

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

      const restoreContentAndResolve = () => {
        document.body.innerHTML = originalContent;
        document.title = originalTitle;
        const printStyleElement = document.getElementById('print-styles-single');
        if (printStyleElement) {
          printStyleElement.remove();
        }
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
        }, 5000);
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

  // MODIFIED: Netlify-optimized loadImageAsBase64 method
  async loadImageAsBase64() {
    try {
      const timestamp = new Date().getTime();
      const possiblePaths = [
        `/assets/cms.png?v=${timestamp}`,
        `./assets/cms.png?v=${timestamp}`,
        `/cms.png?v=${timestamp}`,
        `./cms.png?v=${timestamp}`,
        `assets/cms.png?v=${timestamp}`,
        `cms.png?v=${timestamp}`,
        '/assets/cms.png',
        './assets/cms.png',
        'assets/cms.png',
        '/cms.png',
        './cms.png',
        'cms.png'
      ];

      let response: Response | null = null;
      let successfulPath = '';

      for (const path of possiblePaths) {
        try {
          console.log(`Trying to load logo from: ${path}`);
          
          response = await fetch(path, {
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          
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
        console.log('Current hostname:', window.location.hostname);
        console.log('Is Netlify:', window.location.hostname.includes('netlify'));
        this.logoBase64 = '';
        return '';
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        console.error('Retrieved empty blob');
        this.logoBase64 = '';
        return '';
      }

      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          this.logoBase64 = reader.result as string;
          console.log('Logo loaded successfully from:', successfulPath);
          console.log('Logo base64 length:', this.logoBase64.length);
          
          try {
            sessionStorage.setItem('logoBase64', this.logoBase64);
          } catch (e) {
            console.log('Could not store in sessionStorage:', e);
          }
          
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
      
      try {
        const cached = sessionStorage.getItem('logoBase64');
        if (cached) {
          console.log('Using cached logo from sessionStorage');
          this.logoBase64 = cached;
          return cached;
        }
      } catch (e) {
        console.log('Could not retrieve from sessionStorage:', e);
      }
      
      this.logoBase64 = '';
      return '';
    }
  }

  // MODIFIED: Netlify-optimized loadSignature method
  async loadSignature() {
    try {
      const timestamp = new Date().getTime();
      const possiblePaths = [
        `/assets/signature.png?v=${timestamp}`,
        `./assets/signature.png?v=${timestamp}`,
        `/signature.png?v=${timestamp}`,
        `./signature.png?v=${timestamp}`,
        `assets/signature.png?v=${timestamp}`,
        `signature.png?v=${timestamp}`,
        '/assets/signature.png',
        './assets/signature.png',
        'assets/signature.png',
        '/signature.png',
        './signature.png',
        'signature.png'
      ];

      let response: Response | null = null;
      let successfulPath = '';

      for (const path of possiblePaths) {
        try {
          console.log(`Trying to load signature from: ${path}`);
          response = await fetch(path, {
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          
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
      if (blob.size === 0) {
        console.error('Retrieved empty signature blob');
        this.signatureBase64 = '';
        return '';
      }

      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          this.signatureBase64 = reader.result as string;
          console.log('Signature loaded successfully from:', successfulPath);
          
          try {
            sessionStorage.setItem('signatureBase64', this.signatureBase64);
          } catch (e) {
            console.log('Could not store signature in sessionStorage:', e);
          }
          
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
      
      try {
        const cached = sessionStorage.getItem('signatureBase64');
        if (cached) {
          console.log('Using cached signature from sessionStorage');
          this.signatureBase64 = cached;
          return cached;
        }
      } catch (e) {
        console.log('Could not retrieve signature from sessionStorage:', e);
      }
      
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
    if (this.isSubmitting) return;

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
    if (this.isSubmitting) return;

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

        if (formData.scooterId) {
          await this.updateScooterAvailability(formData.scooterId, false);
        }

        await this.loadScooters();
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

    const accessoriesArray = this.form.get('accessories') as FormArray;
    while (accessoriesArray.length !== 0) {
      accessoriesArray.removeAt(0);
    }
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox: any) => {
      checkbox.checked = false;
    });
  }

  // MODIFIED: Enhanced printContract method with asset reload
  async printContract(rental?: any) {
    const isNewRental = !rental;

    if (isNewRental && !this.form.valid) {
      this.form.markAllAsTouched();
      alert('Please fill in all required fields correctly before printing.');
      return;
    }

    this.isSubmitting = true;

    try {
      let rentalData: any;

      if (isNewRental) {
        this.form.get('isRentActive')?.patchValue(true, { emitEvent: false });
        const formData = this.form.value;
        const selectedScooter = this.scooters.find(s => s.id === formData.scooterId);

        rentalData = {
          ...formData,
          scooterName: selectedScooter ? (selectedScooter.scooterModel || `Scooter ${selectedScooter.id}`) : 'Unknown Scooter',
          createdAt: new Date()
        };

        await this.saveFormData(rentalData);

        if (formData.scooterId) {
          await this.updateScooterAvailability(formData.scooterId, false);
        }

        this.resetForm();
        await this.loadScooters();
        await this.loadRentals();
      } else {
        rentalData = rental;
      }

      // MODIFIED: Force reload assets if missing before printing
      if (!this.logoBase64 || !this.signatureBase64) {
        console.log('🔄 Assets missing for contract, forcing reload...');
        await this.loadImageAsBase64();
        await this.loadSignature();
      }

      const meetingDateStr = rentalData.meetingDate
        ? (rentalData.meetingDate.toDate
          ? rentalData.meetingDate.toDate().toLocaleDateString()
          : new Date(rentalData.meetingDate).toLocaleDateString())
        : '______________';

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
                ${logoImage ? `<img src="${logoImage}" alt="Logo" style="height: 50px;" />` : '<div style="height: 50px; width: 100px; border: 2px solid red; display: flex; align-items: center; justify-content: center; font-size: 8px;">LOGO MISSING</div>'}
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

      await this.executePrint(printContent, isNewRental ? 'Contract' : `Contract - ${rentalData.name}`);

      if (isNewRental) {
        alert('Form saved successfully! Scooter is now marked as unavailable.');
      }

    } catch (error) {
      console.error('Error printing:', error);
      alert('Error creating print document. Please try again.');
      this.isSubmitting = false;
    }
  }

  private async executePrint(printContent: string, title: string): Promise<void> {
    return new Promise((resolve) => {
      const originalContent = document.body.innerHTML;
      const originalTitle = document.title;

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

      const duplicatedContent = `
      ${printStyles}
      <div class="print-container">
        ${printContent}
      </div>
      <div class="print-container page-break">
        ${printContent}
      </div>
    `;

      document.title = title;
      document.body.innerHTML = duplicatedContent;

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

      const restoreContentAndResolve = () => {
        document.body.innerHTML = originalContent;
        document.title = originalTitle;
        const printStyleElement = document.getElementById('print-styles');
        if (printStyleElement) {
          printStyleElement.remove();
        }
        
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
        }, 5000);
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

  getDateCellClass(meetingDate: any): string {
    if (!meetingDate) return '';

    const today = new Date();
    const dueDate = meetingDate.toDate ? meetingDate.toDate() : new Date(meetingDate);

    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const timeDiff = dueDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysDiff < 0) {
      return 'overdue-date';
    } else if (daysDiff === 0) {
      return 'due-tomorrow';
    } else if (daysDiff === 1) {
      return 'due-tomorrow';
    }

    return '';
  }

  getRowClass(element: any): string {
    if (!element.meetingDate) return '';

    const today = new Date();
    const dueDate = element.meetingDate.toDate ? element.meetingDate.toDate() : new Date(element.meetingDate);

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