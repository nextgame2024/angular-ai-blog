import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';
import { BmCollege, BmCollegeContact, BmCollegeSite, ManagerCollegesService } from '../../services/manager.colleges.service';

@Component({
  selector: 'app-manager-colleges-page',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
  templateUrl: './manager-colleges.page.html',
  styleUrls: ['../clients/manager-clients.page.css', './manager-colleges.page.css'],
})
export class ManagerCollegesPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(ManagerCollegesService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyed = new Subject<void>();
  private listRequest = 0;

  readonly search = this.fb.control('', { nonNullable: true });
  readonly collegeForm = this.fb.group({
    college_name: ['', [Validators.required, Validators.maxLength(200)]],
    owner_name: [''], abn: [''], notes: [''],
    status: ['active'],
  });
  readonly contactForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    role_title: [''], email: ['', Validators.email], cel: [''], tel: [''],
  });
  readonly statusOptions = [
    { value: 'active', label: 'active' },
    { value: 'archived', label: 'archived' },
  ];
  readonly primaryOptions = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ];
  readonly siteForm = this.fb.group({
    city: ['', [Validators.required, Validators.maxLength(120)]],
    category: ['', Validators.maxLength(120)],
    address: ['', Validators.maxLength(500)],
    email: ['', Validators.email],
    phone: ['', Validators.maxLength(80)],
    mobile: ['', Validators.maxLength(80)],
    is_primary: ['no'],
  });

  colleges: BmCollege[] = [];
  contacts: BmCollegeContact[] = [];
  sites: BmCollegeSite[] = [];
  selected: BmCollege | null = null;
  editingContact: BmCollegeContact | null = null;
  editingSite: BmCollegeSite | null = null;
  mode: 'list' | 'details' = 'list';
  tab: 'details' | 'contacts' | 'sites' = 'details';
  contactMode: 'list' | 'form' = 'list';
  siteMode: 'list' | 'form' = 'list';
  page = 1;
  total = 0;
  loading = false;
  saving = false;
  contactsLoading = false;
  sitesLoading = false;
  error = '';
  notice = '';
  warningDismissed = false;

  ngOnInit(): void {
    this.load();
    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroyed))
      .subscribe(() => this.load());
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  load(page = 1): void {
    const request = ++this.listRequest;
    this.loading = true;
    this.error = '';
    if (page === 1) this.colleges = [];
    this.api.list(this.search.value.trim(), page).pipe(takeUntil(this.destroyed)).subscribe({
      next: (result) => {
        if (request !== this.listRequest) return;
        this.colleges = page === 1 ? result.colleges : [...this.colleges, ...result.colleges];
        this.page = result.page;
        this.total = result.total;
        this.loading = false;
      },
      error: (err) => { if (request !== this.listRequest) return; this.error = err?.error?.error || 'Could not load colleges.'; this.loading = false; },
    });
  }

  create(): void {
    this.selected = null;
    this.mode = 'details';
    this.tab = 'details';
    this.warningDismissed = false;
    this.collegeForm.reset({ status: 'active' });
    this.contacts = [];
    this.sites = [];
    this.error = '';
  }

  edit(college: BmCollege): void {
    this.selected = college;
    this.mode = 'details';
    this.tab = 'details';
    this.error = '';
    this.collegeForm.reset({
      college_name: college.collegeName, owner_name: college.ownerName,
      abn: college.abn, notes: college.notes, status: college.status,
    });
  }

  close(): void { this.mode = 'list'; this.contactMode = 'list'; this.siteMode = 'list'; this.load(); }

  save(close = false): void {
    if (this.collegeForm.invalid) {
      this.collegeForm.markAllAsTouched();
      this.error = 'Enter a college name.';
      return;
    }
    const value = this.collegeForm.getRawValue();
    this.saving = true;
    this.error = '';
    const request = this.selected
      ? this.api.update(this.selected.collegeId, value)
      : this.api.create(value);
    request.pipe(takeUntil(this.destroyed)).subscribe({
      next: ({ college }) => {
        this.selected = college;
        this.saving = false;
        this.notice = 'College saved.';
        if (close) this.close();
      },
      error: (err) => { this.error = err?.error?.error || 'Could not save college.'; this.saving = false; },
    });
  }

  archive(college: BmCollege): void {
    if (!confirm(`Archive ${college.collegeName}?`)) return;
    this.api.archive(college.collegeId).pipe(takeUntil(this.destroyed)).subscribe({
      next: () => { this.notice = 'College archived.'; this.load(); },
      error: (err) => { this.error = err?.error?.error || 'Could not archive college.'; },
    });
  }

  showContacts(): void {
    if (!this.selected) return;
    this.tab = 'contacts';
    this.contactMode = 'list';
    this.refreshContacts();
  }

  showSites(): void {
    if (!this.selected) return;
    this.tab = 'sites';
    this.siteMode = 'list';
    this.refreshSites();
  }

  refreshSites(): void {
    if (!this.selected) return;
    this.sitesLoading = true;
    this.api.sites(this.selected.collegeId).pipe(takeUntil(this.destroyed)).subscribe({
      next: ({ sites }) => { this.sites = sites; this.sitesLoading = false; },
      error: (err) => { this.error = err?.error?.error || 'Could not load sites.'; this.sitesLoading = false; },
    });
  }

  addSite(): void {
    this.editingSite = null;
    this.siteForm.reset({ is_primary: this.sites.length ? 'no' : 'yes' });
    this.siteMode = 'form';
  }

  editSite(site: BmCollegeSite): void {
    this.editingSite = site;
    this.siteForm.reset({
      city: site.city, category: site.category, address: site.address,
      email: site.email, phone: site.phone, mobile: site.mobile,
      is_primary: site.isPrimary ? 'yes' : 'no',
    });
    this.siteMode = 'form';
  }

  saveSite(): void {
    if (!this.selected) return;
    if (this.siteForm.invalid) {
      this.siteForm.markAllAsTouched();
      this.error = 'Enter a city and valid site details.';
      return;
    }
    const { is_primary, ...fields } = this.siteForm.getRawValue();
    const value = { ...fields, is_primary: is_primary === 'yes' };
    this.saving = true;
    this.error = '';
    const request = this.editingSite
      ? this.api.updateSite(this.selected.collegeId, this.editingSite.siteId, value)
      : this.api.createSite(this.selected.collegeId, value);
    request.pipe(takeUntil(this.destroyed)).subscribe({
      next: () => {
        this.saving = false;
        this.siteMode = 'list';
        this.notice = 'Site saved.';
        this.refreshSites();
        this.refreshCollege();
      },
      error: (err) => { this.error = err?.error?.error || 'Could not save site.'; this.saving = false; },
    });
  }

  deleteSite(site: BmCollegeSite): void {
    if (!this.selected || !confirm(`Delete the ${site.city || 'selected'} site?`)) return;
    this.api.deleteSite(this.selected.collegeId, site.siteId).pipe(takeUntil(this.destroyed)).subscribe({
      next: () => { this.notice = 'Site deleted.'; this.refreshSites(); this.refreshCollege(); },
      error: (err) => { this.error = err?.error?.error || 'Could not delete site.'; },
    });
  }

  private refreshCollege(): void {
    if (!this.selected) return;
    this.api.get(this.selected.collegeId).pipe(takeUntil(this.destroyed)).subscribe({
      next: ({ college }) => { this.selected = college; },
      error: (err) => { this.error = err?.error?.error || 'Could not refresh college details.'; },
    });
  }

  refreshContacts(): void {
    if (!this.selected) return;
    this.contactsLoading = true;
    this.api.contacts(this.selected.collegeId).pipe(takeUntil(this.destroyed)).subscribe({
      next: ({ contacts }) => { this.contacts = contacts; this.contactsLoading = false; },
      error: (err) => { this.error = err?.error?.error || 'Could not load contacts.'; this.contactsLoading = false; },
    });
  }

  addContact(): void {
    this.editingContact = null;
    this.contactForm.reset();
    this.contactMode = 'form';
  }

  editContact(contact: BmCollegeContact): void {
    this.editingContact = contact;
    this.contactForm.reset({
      name: contact.name, role_title: contact.roleTitle, email: contact.email,
      cel: contact.cel, tel: contact.tel,
    });
    this.contactMode = 'form';
  }

  saveContact(): void {
    if (!this.selected) return;
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      this.error = 'Enter a contact name and a valid email address.';
      return;
    }
    this.saving = true;
    this.error = '';
    const request = this.editingContact
      ? this.api.updateContact(this.selected.collegeId, this.editingContact.contactId, this.contactForm.getRawValue())
      : this.api.createContact(this.selected.collegeId, this.contactForm.getRawValue());
    request.pipe(takeUntil(this.destroyed)).subscribe({
      next: () => { this.saving = false; this.contactMode = 'list'; this.notice = 'Contact saved.'; this.refreshContacts(); },
      error: (err) => { this.error = err?.error?.error || 'Could not save contact.'; this.saving = false; },
    });
  }

  deleteContact(contact: BmCollegeContact): void {
    if (!this.selected || !confirm(`Delete ${contact.name}?`)) return;
    this.api.deleteContact(this.selected.collegeId, contact.contactId).pipe(takeUntil(this.destroyed)).subscribe({
      next: () => { this.notice = 'Contact deleted.'; this.refreshContacts(); },
      error: (err) => { this.error = err?.error?.error || 'Could not delete contact.'; },
    });
  }
}
