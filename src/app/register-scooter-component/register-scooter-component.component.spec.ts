import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegisterScooterComponentComponent } from './register-scooter-component.component';

describe('RegisterScooterComponentComponent', () => {
  let component: RegisterScooterComponentComponent;
  let fixture: ComponentFixture<RegisterScooterComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterScooterComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegisterScooterComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
