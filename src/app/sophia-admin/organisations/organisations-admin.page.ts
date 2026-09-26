import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { switchMap } from 'rxjs';

import { AdminStatePanelComponent } from '../shared/admin-state-panel.component';
import { adminErrorMessage, hasRecentMfa } from '../shared/admin-operation.utils';
import { SophiaAdminService } from '../sophia-admin.service';
import type { SophiaAdminOrganisation, SophiaAdminPrincipal } from '../sophia-admin.types';

@Component({
  selector: 'app-organisations-admin-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AdminStatePanelComponent],
  templateUrl: './organisations-admin.page.html',
  styleUrls: ['./organisations-admin.page.css'],
})
export class OrganisationsAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly principal = signal<SophiaAdminPrincipal | null>(null);
  readonly organisation = signal<SophiaAdminOrganisation | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly suspensionReason = this.fb.nonNullable.control('', [Validators.required, Validators.minLength(3), Validators.maxLength(1000)]);
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    displayName: ['', Validators.maxLength(200)],
    primaryColour: ['', Validators.pattern(/^#[0-9a-fA-F]{6}$/)],
    timezone: ['', Validators.maxLength(80)],
    defaultLocale: ['', Validators.maxLength(35)],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.admin.context().pipe(
      switchMap(({ principal }) => {
        this.principal.set(principal);
        return this.admin.getOrganisation(principal.tenantId);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (organisation) => {
        this.applyOrganisation(organisation);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(adminErrorMessage(error, 'The organisation could not be loaded.'));
        this.loading.set(false);
      },
    });
  }

  can(permission: string): boolean {
    return this.principal()?.permissions.includes(permission) ?? false;
  }

  get privilegedReady(): boolean {
    return hasRecentMfa(this.principal()?.mfaVerifiedAt);
  }

  save(): void {
    const organisation = this.organisation();
    const principal = this.principal();
    if (!organisation || !principal || !this.can('organisation.manage') || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    const displayName = value.displayName.trim();
    const primaryColour = value.primaryColour.trim();
    const timezone = value.timezone.trim();
    const defaultLocale = value.defaultLocale.trim();
    this.admin.updateOrganisation(principal.tenantId, {
      expectedRevision: organisation.settings_revision,
      name: value.name.trim(),
      ...(timezone ? { timezone } : {}),
      ...(defaultLocale ? { defaultLocale } : {}),
      ...(displayName || primaryColour ? { branding: {
        ...(displayName ? { displayName } : {}),
        ...(primaryColour ? { primaryColour } : {}),
      } } : {}),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.applyOrganisation(updated);
        this.notice.set('Organisation settings saved. The change was recorded in the Admin audit trail.');
        this.saving.set(false);
      },
      error: (error) => {
        this.error.set(adminErrorMessage(error, 'The organisation could not be updated.'));
        this.saving.set(false);
      },
    });
  }

  suspend(): void {
    const organisation = this.organisation();
    const principal = this.principal();
    if (!organisation || !principal || !this.can('organisation.suspend') || !this.privilegedReady || this.suspensionReason.invalid) {
      this.suspensionReason.markAsTouched();
      return;
    }
    this.lifecycleRequest(this.admin.suspendOrganisation(
      principal.tenantId,
      organisation.settings_revision,
      this.suspensionReason.value.trim(),
    ), 'New Sophia session admission is suspended. Existing business records were not deleted.');
  }

  resume(): void {
    const organisation = this.organisation();
    const principal = this.principal();
    if (!organisation || !principal || !this.can('organisation.suspend') || !this.privilegedReady) return;
    this.lifecycleRequest(
      this.admin.resumeOrganisation(principal.tenantId, organisation.settings_revision),
      'Sophia session admission resumed.',
    );
  }

  private lifecycleRequest(request: ReturnType<SophiaAdminService['resumeOrganisation']>, notice: string): void {
    this.saving.set(true);
    this.error.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.applyOrganisation({ ...this.organisation()!, ...updated });
        this.notice.set(notice);
        this.suspensionReason.reset('');
        this.saving.set(false);
      },
      error: (error) => {
        this.error.set(adminErrorMessage(error, 'The organisation lifecycle could not be changed.'));
        this.saving.set(false);
      },
    });
  }

  private applyOrganisation(organisation: SophiaAdminOrganisation): void {
    this.organisation.set(organisation);
    this.form.setValue({
      name: organisation.name ?? '',
      displayName: organisation.metadata?.branding?.displayName ?? '',
      primaryColour: organisation.metadata?.branding?.primaryColour ?? '',
      timezone: organisation.metadata?.timezone ?? '',
      defaultLocale: organisation.metadata?.defaultLocale ?? '',
    });
  }
}
