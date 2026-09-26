import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SophiaAdminService } from '../sophia-admin.service';
import { UsageBillingAdminPage } from './usage-billing-admin.page';

describe('UsageBillingAdminPage', () => {
  let fixture: ComponentFixture<UsageBillingAdminPage>;
  let admin: jasmine.SpyObj<SophiaAdminService>;

  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', [
      'context', 'usageWorkspace', 'usageLimits', 'commercialWorkspace', 'updateUsageLimits',
      'createBillingCheckout', 'createBillingPortal', 'reconcileBilling',
    ]);
    admin.context.and.returnValue(of({ principal: {
      tenantId: 'tenant-1', identityUserId: 'billing-1', role: 'billing_administrator',
      permissions: ['usage.read', 'billing.read'],
    } }));
    admin.usageWorkspace.and.returnValue(of({
      tenantId: 'tenant-1', generatedAt: '2026-09-26T00:00:00Z', statusCounts: { measured: 2 },
      providers: [{ providerId: 'neutral-reasoning', adapterKey: 'neutral-v1', measurementStatus: 'measured', eventCount: 2 }],
      dimensionTotals: [{ dimension: 'reasoning-input-tokens', measurementStatus: 'measured', quantity: '10.5' }],
      providerCostEstimates: [{ currency: 'AUD', costTableVersion: 'provider-v1', measurementStatus: 'estimated',
        estimatedMicrounits: '1500', customerCharge: false }],
      commercialPolicy: { status: 'not_configured', customerCharges: false },
      budgetAlert: { status: 'unavailable', reason: 'No approved tenant budget exists.' },
    }));
    admin.usageLimits.and.returnValue(of({
      tenantId: 'tenant-1', generatedAt: '2026-09-26T00:00:00Z',
      limits: {
        platformHardCaps: { maxConcurrentSessions: 10, maxToolCallsPerMinute: 20 }, commercialCeilings: null,
        tenantGuardrails: { revision: 1, maxConcurrentSessions: 3, maxToolCallsPerMinute: 8,
          providerCostAlertMicrounits: '1000', providerCostAlertCurrency: 'AUD' },
        effective: { maxConcurrentSessions: 3, maxToolCallsPerMinute: 8 },
      },
      providerCostAlert: { status: 'active', period: { boundary: 'calendar_utc', interval: 'month' }, currency: 'AUD',
        thresholdMicrounits: '1000', estimatedMicrounits: '1500', admissionEnforcement: false, customerCharge: false,
        detail: 'This compares versioned provider-cost estimates only.' },
    }));
    admin.commercialWorkspace.and.returnValue(of({
      tenantId: 'tenant-1', generatedAt: '2026-09-26T00:00:00Z',
      providerIntegration: { availability: 'disabled', providerKey: null, checkout: false, portal: false,
        signedWebhooks: false, reconciliation: false, missingConfiguration: ['provider'],
        detail: 'No Sophia billing provider is configured.' },
      assignment: null,
      preview: { status: 'unavailable', chargeExecution: false, reason: 'No active Sophia commercial plan assignment exists.' },
      subscriptions: [], invoices: [], providerCustomers: [], recentWebhookEvents: [], activeCheckoutIntent: null,
      authority: { tenantPlanMutation: 'unavailable', detail: 'Tenant administrators cannot publish rate cards.' },
      isolation: { existingPayments: 'excluded', detail: 'Existing business payment objects are outside this namespace.' },
    }));
    await TestBed.configureTestingModule({
      imports: [UsageBillingAdminPage], providers: [{ provide: SophiaAdminService, useValue: admin }],
    }).compileComponents();
    fixture = TestBed.createComponent(UsageBillingAdminPage); fixture.detectChanges();
  });

  it('separates usage, provider estimates, budget availability and charge execution', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('reasoning-input-tokens'); expect(text).toContain('10.5');
    expect(text).toContain('Not customer charges'); expect(text).toContain('Customer charge: no');
    expect(text).toContain('3 concurrent sessions'); expect(text).toContain('8 tool attempts');
    expect(text).toContain('1500 / 1000 AUD microunits'); expect(text).toContain('Admission enforcement: no');
    expect(text).toContain('Balance enforcement unavailable');
    expect(text).toContain('Charge preview unavailable'); expect(text).toContain('Charge execution: disabled');
    expect(text).toContain('Tenant administrators cannot publish rate cards.');
    expect(text).toContain('Sandbox configuration still required: provider');
    expect(text).toContain('Raw webhook bodies and card data are never stored.');
  });
});
