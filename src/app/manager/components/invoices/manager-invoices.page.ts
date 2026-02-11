import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { ManagerDocumentsService } from '../../services/manager.documents.service';
import { ManagerProjectsService } from '../../services/manager.projects.service';
import type { BmDocument } from '../../types/documents.interface';
import type { BmProject, BmProjectLabor, BmProjectMaterial } from '../../types/projects.interface';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-manager-invoices-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './manager-invoices.page.html',
  styleUrls: ['./manager-invoices.page.css'],
})
export class ManagerInvoicesPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  viewMode: 'list' | 'detail' = 'list';
  activeTab: 'details' | 'materials' | 'labor' = 'details';
  materialsViewMode: 'list' | 'view' = 'list';
  laborViewMode: 'list' | 'view' = 'list';

  loading = false;
  detailLoading = false;
  error: string | null = null;

  invoices: BmDocument[] = [];
  filteredInvoices$ = new BehaviorSubject<BmDocument[]>([]);
  total = 0;
  currentPage = 1;
  limit = 20;
  canLoadMore = false;
  isLoadingMore = false;
  private infiniteObserver?: IntersectionObserver;
  selectedInvoice: BmDocument | null = null;
  selectedProject: BmProject | null = null;
  projectMaterials: BmProjectMaterial[] = [];
  projectLabor: BmProjectLabor[] = [];
  selectedMaterial: BmProjectMaterial | null = null;
  selectedLabor: BmProjectLabor | null = null;
  netMaterialsCost = 0;
  netLaborCost = 0;
  totalMaterialsCost = 0;
  totalLaborCost = 0;
  subtotal = 0;
  gstRate = 0;
  gstRatePercent = 0;
  gstAmount = 0;
  grandTotal = 0;
  pdfLoadingId: string | null = null;

  searchCtrl: FormControl<string>;

  projectForm = this.fb.group({
    project_name: [''],
    project_type: [''],
    meters_required: [''],
    client_name: [''],
    status: [''],
    cost_in_quote: [''],
    default_pricing: [''],
    pricing_profile: [''],
    description: [''],
  });

  @ViewChild('invoicesList') invoicesListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private documentsService: ManagerDocumentsService,
    private projectsService: ManagerProjectsService,
  ) {
    this.searchCtrl = this.fb.control('', { nonNullable: true });
  }

  ngOnInit(): void {
    this.projectForm.disable({ emitEvent: false });
    this.loadInvoices(1);

    this.filteredInvoices$
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => {
        this.invoices = items;
      });

    this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentPage = 1;
        this.filteredInvoices$.next([]);
        this.loadInvoices(1);
      });
  }

  ngOnDestroy(): void {
    this.infiniteObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInvoices(page: number, append = false): void {
    if (this.loading || this.isLoadingMore) return;
    if (append) this.isLoadingMore = true;
    else this.loading = true;
    this.error = null;

    const q = (this.searchCtrl.value || '').trim();

    this.documentsService
      .listDocuments({ type: 'invoice', page, limit: this.limit, q })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const items = res.documents || [];
          this.total = res.total ?? items.length;
          const nextItems = append
            ? [...this.filteredInvoices$.value, ...items]
            : items;
          this.filteredInvoices$.next(nextItems);
          this.currentPage = res.page ?? page;
          this.canLoadMore = nextItems.length < this.total;
          this.loading = false;
          this.isLoadingMore = false;
          setTimeout(() => this.setupInfiniteScroll(), 0);
        },
        error: (err) => {
          this.loading = false;
          this.isLoadingMore = false;
          this.error =
            err?.error?.error || err?.message || 'Failed to load invoices';
        },
      });
  }

  openInvoicePdf(doc: BmDocument): void {
    if (!doc?.documentId) return;
    if (this.pdfLoadingId) return;
    this.pdfLoadingId = doc.documentId;
    if (doc.pdfUrl) {
      window.open(doc.pdfUrl, '_blank', 'noopener');
      this.pdfLoadingId = null;
      return;
    }
    const url = `${environment.apiUrl}/bm/documents/${doc.documentId}/invoice-pdf`;
    this.http
      .get(url, { responseType: 'blob' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const file = new Blob([blob], { type: 'application/pdf' });
          const objUrl = window.URL.createObjectURL(file);
          window.open(objUrl, '_blank', 'noopener');
          window.setTimeout(() => window.URL.revokeObjectURL(objUrl), 60_000);
          this.pdfLoadingId = null;
        },
        error: () => {
          this.pdfLoadingId = null;
        },
      });
  }

  viewInvoice(doc: BmDocument): void {
    if (!doc?.projectId) return;
    this.viewMode = 'detail';
    this.activeTab = 'details';
    this.selectedInvoice = doc;
    this.selectedProject = null;
    this.projectMaterials = [];
    this.projectLabor = [];
    this.materialsViewMode = 'list';
    this.selectedMaterial = null;
    this.laborViewMode = 'list';
    this.selectedLabor = null;
    this.detailLoading = true;

    forkJoin({
      project: this.projectsService.getProject(doc.projectId),
      materials: this.projectsService.listProjectMaterials(doc.projectId),
      labor: this.projectsService.listProjectLabor(doc.projectId),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.detailLoading = false;
          this.selectedProject = res.project?.project ?? null;
          this.projectMaterials = res.materials?.materials ?? [];
          this.projectLabor = res.labor?.labor ?? [];
          this.patchProjectForm();
          this.calculateTotals();
        },
        error: (err) => {
          this.detailLoading = false;
          this.error =
            err?.error?.error || err?.message || 'Failed to load project';
        },
      });
  }

  closeDetail(): void {
    this.viewMode = 'list';
    this.selectedInvoice = null;
    this.selectedProject = null;
    this.projectMaterials = [];
    this.projectLabor = [];
    this.materialsViewMode = 'list';
    this.selectedMaterial = null;
    this.netMaterialsCost = 0;
    this.netLaborCost = 0;
    this.totalMaterialsCost = 0;
    this.totalLaborCost = 0;
    this.subtotal = 0;
    this.gstRate = 0;
    this.gstRatePercent = 0;
    this.gstAmount = 0;
    this.grandTotal = 0;
    this.projectForm.reset();
    setTimeout(() => this.setupInfiniteScroll(), 0);
  }

  openMaterialView(m: BmProjectMaterial): void {
    this.selectedMaterial = m;
    this.materialsViewMode = 'view';
  }

  closeMaterialView(): void {
    this.materialsViewMode = 'list';
    this.selectedMaterial = null;
  }

  openLaborView(l: BmProjectLabor): void {
    this.selectedLabor = l;
    this.laborViewMode = 'view';
  }

  closeLaborView(): void {
    this.laborViewMode = 'list';
    this.selectedLabor = null;
  }

  setTab(tab: 'details' | 'materials' | 'labor'): void {
    this.activeTab = tab;
    if (tab !== 'materials') {
      this.materialsViewMode = 'list';
      this.selectedMaterial = null;
    }
    if (tab !== 'labor') {
      this.laborViewMode = 'list';
      this.selectedLabor = null;
    }
  }

  private patchProjectForm(): void {
    const p = this.selectedProject;
    if (!p) return;
    this.projectForm.patchValue({
      project_name: p.projectName ?? '',
      project_type: p.projectTypeName ?? '',
      meters_required: this.formatNumber(p.metersRequired),
      client_name: p.clientName ?? '',
      status: this.formatStatus(p.status),
      cost_in_quote: p.costInQuote ? 'Yes' : 'No',
      default_pricing: p.defaultPricing ? 'Yes' : 'No',
      pricing_profile: p.pricingProfileName ?? '',
      description: p.description ?? '',
    });
  }

  formatStatus(status?: string | null): string {
    if (!status) return '';
    return status
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }

  formatNumber(value?: number | string | null): string {
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    if (Number.isNaN(n)) return '';
    return n.toFixed(2);
  }

  formatMoney(value?: number | string | null): string {
    if (value === null || value === undefined || value === '') return '0.00';
    const n = Number(value);
    if (Number.isNaN(n)) return '0.00';
    return n.toFixed(2);
  }

  private calculateTotals(): void {
    const project = this.selectedProject;
    const metersRequired = project?.metersRequired ?? null;
    const projectTypeId = project?.projectTypeId ?? null;
    this.netMaterialsCost = this.calculateNetMaterialsCost(
      this.projectMaterials,
      projectTypeId,
      metersRequired,
    );
    this.netLaborCost = this.calculateNetLaborCost(
      this.projectLabor,
      projectTypeId,
      metersRequired,
    );
    this.totalMaterialsCost = Number(this.selectedInvoice?.materialTotal ?? 0);
    this.totalLaborCost = Number(this.selectedInvoice?.laborTotal ?? 0);
    this.subtotal = Number(
      this.selectedInvoice?.subtotal ??
        this.totalMaterialsCost + this.totalLaborCost,
    );
    const totalAmount = Number(this.selectedInvoice?.totalAmount ?? 0);
    const docGst = Number(this.selectedInvoice?.gst ?? 0);
    this.gstAmount =
      docGst || (totalAmount && this.subtotal ? totalAmount - this.subtotal : 0);
    this.gstRate = this.subtotal > 0 ? this.gstAmount / this.subtotal : 0;
    this.gstRatePercent = this.gstRate * 100;
    this.grandTotal = totalAmount || this.subtotal + this.gstAmount;
  }

  private calculateNetMaterialsCost(
    materials: BmProjectMaterial[] | null | undefined,
    projectTypeId: string | null,
    metersRequired: number | string | null,
  ): number {
    const items = materials ?? [];
    if (projectTypeId) {
      return this.calculateCoverageNet(items, metersRequired);
    }
    return items.reduce((sum, m) => {
      const qty = Number(m.quantity ?? 1);
      const cost = Number(m.unitCostOverride ?? 0);
      return sum + cost * qty;
    }, 0);
  }

  private calculateNetLaborCost(
    labor: BmProjectLabor[] | null | undefined,
    projectTypeId: string | null,
    metersRequired: number | string | null,
  ): number {
    const items = labor ?? [];
    if (projectTypeId) {
      return this.calculateProductivityNet(items, metersRequired);
    }
    return items.reduce((sum, l) => {
      const qty = Number(l.quantity ?? 1);
      const cost = Number(l.unitCostOverride ?? 0);
      return sum + cost * qty;
    }, 0);
  }

  private calculateCoverageNet(
    materials: BmProjectMaterial[],
    metersRequired: number | string | null,
  ): number {
    const meters = Number(metersRequired ?? 0);
    if (!Number.isFinite(meters) || meters <= 0) return 0;
    return materials.reduce((sum, m) => {
      const coverage = Number(m.coverageRatio ?? 0);
      if (!Number.isFinite(coverage) || coverage <= 0) return sum;
      const qty = Number(m.quantity ?? 1);
      const unitCost = Number(m.unitCostOverride ?? 0);
      if (!Number.isFinite(unitCost) || !Number.isFinite(qty) || qty <= 0) {
        return sum;
      }
      const costPerUnit = unitCost / qty;
      return sum + (meters / coverage) * costPerUnit;
    }, 0);
  }

  private calculateProductivityNet(
    labor: BmProjectLabor[],
    metersRequired: number | string | null,
  ): number {
    const meters = Number(metersRequired ?? 0);
    if (!Number.isFinite(meters) || meters <= 0) return 0;
    return labor.reduce((sum, l) => {
      const productivity = Number(l.unitProductivity ?? 0);
      if (!Number.isFinite(productivity) || productivity <= 0) return sum;
      const unitCost = Number(l.unitCostOverride ?? 0);
      if (!Number.isFinite(unitCost)) return sum;
      return sum + (meters / productivity) * unitCost;
    }, 0);
  }

  private setupInfiniteScroll(): void {
    if (this.viewMode !== 'list') return;
    const sentinel = this.infiniteSentinelRef?.nativeElement;
    const list = this.invoicesListRef?.nativeElement;
    if (!sentinel || !list) return;

    this.infiniteObserver?.disconnect();

    const scrollRoot = list.closest('.content') as HTMLElement | null;
    this.infiniteObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!this.canLoadMore || this.loading || this.isLoadingMore) return;
        this.loadInvoices(this.currentPage + 1, true);
      },
      { root: scrollRoot, rootMargin: '200px 0px', threshold: 0.1 },
    );

    this.infiniteObserver.observe(sentinel);
  }
}
