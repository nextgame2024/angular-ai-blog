import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';
import { BmCollege, BmCollegeContact, BmCollegeSite, BmCollegeSort, ManagerCollegesService } from '../../services/manager.colleges.service';

@Component({
  selector: 'app-manager-colleges-page',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
  templateUrl: './manager-colleges.page.html',
  styleUrls: ['../clients/manager-clients.page.css', '../users/manager-users.page.css', './manager-colleges.page.css'],
})
export class ManagerCollegesPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(ManagerCollegesService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyed = new Subject<void>();
  private listRequest = 0;

  readonly search = this.fb.control('', { nonNullable: true });
  readonly pageSizeCtrl = this.fb.control('25', { nonNullable: true });
  readonly contactPageSizeCtrl = this.fb.control('25', { nonNullable: true });
  readonly sitePageSizeCtrl = this.fb.control('25', { nonNullable: true });
  readonly pageSizeOptions = [{ value: '25', label: '25 per page' }, { value: '50', label: '50 per page' }, { value: '100', label: '100 per page' }];
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
  contactPage = 1;
  sitePage = 1;
  total = 0;
  sort: BmCollegeSort = 'name';
  direction: 'asc' | 'desc' = 'asc';
  contactSort: 'name' | 'role' | 'email' | 'mobile' = 'name';
  contactDirection: 'asc' | 'desc' = 'asc';
  siteSort: 'city' | 'category' | 'address' | 'email' | 'phone' | 'mobile' | 'primary' = 'city';
  siteDirection: 'asc' | 'desc' = 'asc';
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
    this.pageSizeCtrl.valueChanges.pipe(takeUntil(this.destroyed)).subscribe(() => this.load());
    this.contactPageSizeCtrl.valueChanges.pipe(takeUntil(this.destroyed)).subscribe(() => this.contactPage = 1);
    this.sitePageSizeCtrl.valueChanges.pipe(takeUntil(this.destroyed)).subscribe(() => this.sitePage = 1);
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  load(page = 1): void {
    const request = ++this.listRequest;
    this.loading = true;
    this.error = '';
    this.api.list(this.search.value.trim(), page, this.pageLimit, this.sort, this.direction).pipe(takeUntil(this.destroyed)).subscribe({
      next: (result) => {
        if (request !== this.listRequest) return;
        if (page > 1 && !result.colleges.length && result.total > 0) {
          this.load(Math.max(1, Math.ceil(result.total / this.pageLimit)));
          return;
        }
        this.colleges = result.colleges;
        this.page = result.page;
        this.total = result.total;
        this.loading = false;
      },
      error: (err) => { if (request !== this.listRequest) return; this.error = err?.error?.error || 'Could not load colleges.'; this.loading = false; },
    });
  }

  get pageLimit(): number { return Number(this.pageSizeCtrl.value) || 25; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageLimit)); }
  get pageStart(): number { return this.total ? (this.page - 1) * this.pageLimit + 1 : 0; }
  get pageEnd(): number { return Math.min(this.page * this.pageLimit, this.total); }
  sortBy(column: BmCollegeSort): void {
    this.direction = this.sort === column && this.direction === 'asc' ? 'desc' : 'asc';
    this.sort = column;
    this.load();
  }
  sortAria(column: BmCollegeSort): string { return this.sort === column ? (this.direction === 'asc' ? 'ascending' : 'descending') : 'none'; }
  goToPage(page: number): void { if (page >= 1 && page <= this.totalPages && page !== this.page && !this.loading) this.load(page); }

  get contactPageLimit(): number { return Number(this.contactPageSizeCtrl.value) || 25; }
  get contactTotalPages(): number { return Math.max(1, Math.ceil(this.contacts.length / this.contactPageLimit)); }
  get contactPageStart(): number { return this.contacts.length ? (this.contactPage - 1) * this.contactPageLimit + 1 : 0; }
  get contactPageEnd(): number { return Math.min(this.contactPage * this.contactPageLimit, this.contacts.length); }
  get displayedContacts(): BmCollegeContact[] {
    const fields = { name: 'name', role: 'roleTitle', email: 'email', mobile: 'cel' } as const;
    const key = fields[this.contactSort];
    const sorted = [...this.contacts].sort((a, b) => this.compareText(a[key], b[key], this.contactDirection) || a.contactId.localeCompare(b.contactId));
    return sorted.slice((this.contactPage - 1) * this.contactPageLimit, this.contactPage * this.contactPageLimit);
  }
  sortContactsBy(column: typeof this.contactSort): void {
    this.contactDirection = this.contactSort === column && this.contactDirection === 'asc' ? 'desc' : 'asc';
    this.contactSort = column;
    this.contactPage = 1;
  }
  contactSortAria(column: typeof this.contactSort): string { return this.contactSort === column ? (this.contactDirection === 'asc' ? 'ascending' : 'descending') : 'none'; }
  goToContactPage(page: number): void { if (page >= 1 && page <= this.contactTotalPages) this.contactPage = page; }

  get sitePageLimit(): number { return Number(this.sitePageSizeCtrl.value) || 25; }
  get siteTotalPages(): number { return Math.max(1, Math.ceil(this.sites.length / this.sitePageLimit)); }
  get sitePageStart(): number { return this.sites.length ? (this.sitePage - 1) * this.sitePageLimit + 1 : 0; }
  get sitePageEnd(): number { return Math.min(this.sitePage * this.sitePageLimit, this.sites.length); }
  get displayedSites(): BmCollegeSite[] {
    const fields = { city: 'city', category: 'category', address: 'address', email: 'email', phone: 'phone', mobile: 'mobile', primary: 'isPrimary' } as const;
    const key = fields[this.siteSort];
    const sorted = [...this.sites].sort((a, b) => this.compareText(String(a[key] ?? ''), String(b[key] ?? ''), this.siteDirection) || a.siteId.localeCompare(b.siteId));
    return sorted.slice((this.sitePage - 1) * this.sitePageLimit, this.sitePage * this.sitePageLimit);
  }
  sortSitesBy(column: typeof this.siteSort): void {
    this.siteDirection = this.siteSort === column && this.siteDirection === 'asc' ? 'desc' : 'asc';
    this.siteSort = column;
    this.sitePage = 1;
  }
  siteSortAria(column: typeof this.siteSort): string { return this.siteSort === column ? (this.siteDirection === 'asc' ? 'ascending' : 'descending') : 'none'; }
  goToSitePage(page: number): void { if (page >= 1 && page <= this.siteTotalPages) this.sitePage = page; }
  private compareText(a: string | null, b: string | null, direction: 'asc' | 'desc'): number {
    if (!a) return b ? 1 : 0;
    if (!b) return -1;
    return a.localeCompare(b, 'en-AU', { numeric: true, sensitivity: 'base' }) * (direction === 'asc' ? 1 : -1);
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

  close(): void { this.mode = 'list'; this.contactMode = 'list'; this.siteMode = 'list'; this.load(this.page); }

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
      next: () => { this.notice = 'College archived.'; this.load(this.page); },
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
      next: ({ sites }) => { this.sites = sites; this.sitePage = Math.min(this.sitePage, Math.max(1, Math.ceil(sites.length / this.sitePageLimit))); this.sitesLoading = false; },
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
      next: ({ contacts }) => { this.contacts = contacts; this.contactPage = Math.min(this.contactPage, Math.max(1, Math.ceil(contacts.length / this.contactPageLimit))); this.contactsLoading = false; },
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
