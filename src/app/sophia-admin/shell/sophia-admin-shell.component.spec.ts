import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

import { SophiaAdminService } from '../sophia-admin.service';
import { SophiaAdminShellComponent } from './sophia-admin-shell.component';

describe('SophiaAdminShellComponent', () => {
  let fixture: ComponentFixture<SophiaAdminShellComponent>;
  let admin: jasmine.SpyObj<SophiaAdminService>;
  let store: jasmine.SpyObj<Store>;

  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>(
      'SophiaAdminService',
      ['context', 'getOrganisation', 'clearContext'],
    );
    store = jasmine.createSpyObj<Store>('Store', ['dispatch']);
    admin.context.and.returnValue(of({
      principal: {
        tenantId: 'tenant-1',
        identityUserId: 'user-1',
        role: 'configuration_editor',
        permissions: ['organisation.read', 'knowledge.read'],
      },
    }));
    admin.getOrganisation.and.returnValue(of({
      customer_id: 'tenant-1',
      name: 'Neutral Company',
      status: 'active',
      metadata: {},
      settings_revision: 1,
    }));
    await TestBed.configureTestingModule({
      imports: [SophiaAdminShellComponent],
      providers: [
        provideRouter([]),
        { provide: SophiaAdminService, useValue: admin },
        { provide: Store, useValue: store },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SophiaAdminShellComponent);
    fixture.detectChanges();
  });

  it('shows all sixteen modules while linking only delivered, permitted workspaces', () => {
    const element = fixture.nativeElement as HTMLElement;
    const moduleItems = element.querySelectorAll('.sidebar nav > *');
    expect(moduleItems.length).toBe(16);
    const knowledgeLink = Array.from(element.querySelectorAll('.sidebar nav a'))
      .find((item) => item.textContent?.includes('Knowledge'));
    expect(knowledgeLink).toBeTruthy();
    expect(element.textContent).toContain('Neutral Company');
    expect(element.textContent).not.toContain('real estate');
    expect(element.textContent).not.toContain('OpenAI');
  });

  it('clears Admin context before dispatching logout', () => {
    fixture.componentInstance.signOut();
    expect(admin.clearContext).toHaveBeenCalled();
    expect(store.dispatch).toHaveBeenCalled();
    expect(fixture.componentInstance.principal()).toBeNull();
  });
});
