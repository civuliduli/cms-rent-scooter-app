import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeneralDatabaseComponentComponent } from './general-database-component.component';

describe('GeneralDatabaseComponentComponent', () => {
  let component: GeneralDatabaseComponentComponent;
  let fixture: ComponentFixture<GeneralDatabaseComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeneralDatabaseComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeneralDatabaseComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
