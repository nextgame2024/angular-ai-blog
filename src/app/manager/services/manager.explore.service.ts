import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

import type {
  BmExploreVideo,
  ExploreVideosResult,
} from '../types/explore.interface';

type ExploreVideoSeed = Omit<BmExploreVideo, 'videoId'> & {
  videoId: string;
};

function normalizeToken(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

@Injectable({ providedIn: 'root' })
export class ManagerExploreService {
  private readonly pageDelayMs = 220;

  private readonly videos: readonly ExploreVideoSeed[] = [
    {
      videoId: 'bm-clients',
      title: 'Manage clients',
      description:
        'Create client records, centralise contact details, and keep stakeholders aligned from the first conversation.',
      module: 'Clients',
      category: 'Operations',
      level: 'Getting started',
      keywords: ['clients', 'contacts', 'crm', 'stakeholders'],
      durationLabel: '04:18',
      videoUrl: environment.bmClients,
      accentGradient:
        'linear-gradient(135deg, rgba(45, 212, 191, 0.28), rgba(14, 165, 233, 0.88))',
    },
    {
      videoId: 'bm-pricing',
      title: 'Pricing profiles',
      description:
        'Set labour and material defaults, tune markup rules, and speed up quote-ready pricing decisions.',
      module: 'Pricing',
      category: 'Finance',
      level: 'Core workflow',
      keywords: ['pricing', 'markup', 'gst', 'profiles'],
      durationLabel: '05:06',
      videoUrl: environment.bmPricing,
      accentGradient:
        'linear-gradient(135deg, rgba(248, 113, 113, 0.24), rgba(249, 115, 22, 0.84))',
    },
    {
      videoId: 'bm-labor',
      title: 'Labour costs',
      description:
        'Build labour rate cards, daily cost structures, and operational rules used throughout delivery.',
      module: 'Labor costs',
      category: 'Catalog',
      level: 'Core workflow',
      keywords: ['labour', 'rates', 'daily costs', 'staff costing'],
      durationLabel: '03:54',
      videoUrl: environment.bmLabor,
      accentGradient:
        'linear-gradient(135deg, rgba(251, 191, 36, 0.26), rgba(245, 158, 11, 0.86))',
    },
    {
      videoId: 'bm-materials',
      title: 'Materials library',
      description:
        'Organise categories, units, codes, and buy rates so materials stay consistent across quotes and projects.',
      module: 'Materials',
      category: 'Catalog',
      level: 'Core workflow',
      keywords: ['materials', 'rates', 'codes', 'quantities'],
      durationLabel: '04:41',
      videoUrl: environment.bmMaterials,
      accentGradient:
        'linear-gradient(135deg, rgba(129, 140, 248, 0.26), rgba(59, 130, 246, 0.88))',
    },
    {
      videoId: 'bm-suppliers',
      title: 'Suppliers',
      description:
        'Track supplier records, linked materials, and pricing context for cleaner procurement workflows.',
      module: 'Suppliers',
      category: 'Operations',
      level: 'Core workflow',
      keywords: ['suppliers', 'procurement', 'materials', 'buy rates'],
      durationLabel: '04:02',
      videoUrl: environment.bmSuppliers,
      accentGradient:
        'linear-gradient(135deg, rgba(34, 197, 94, 0.24), rgba(16, 185, 129, 0.84))',
    },
    {
      videoId: 'bm-company',
      title: 'Company profile',
      description:
        'Update branding, legal details, and business settings that shape customer-facing outputs.',
      module: 'Company',
      category: 'Setup',
      level: 'Getting started',
      keywords: ['company', 'branding', 'profile', 'settings'],
      durationLabel: '03:21',
      videoUrl: environment.bmCompany,
      accentGradient:
        'linear-gradient(135deg, rgba(244, 114, 182, 0.22), rgba(236, 72, 153, 0.82))',
    },
    {
      videoId: 'bm-users',
      title: 'Manage users',
      description:
        'Set up staff access, user details, and team visibility so everyone works with the right permissions.',
      module: 'Users',
      category: 'Setup',
      level: 'Getting started',
      keywords: ['users', 'permissions', 'staff', 'access'],
      durationLabel: '03:47',
      videoUrl: environment.bmUsers,
      accentGradient:
        'linear-gradient(135deg, rgba(56, 189, 248, 0.22), rgba(99, 102, 241, 0.86))',
    },
    {
      videoId: 'bm-projects',
      title: 'Projects',
      description:
        'Create and manage projects, connect clients, and move work from planning to execution.',
      module: 'Projects',
      category: 'Operations',
      level: 'Core workflow',
      keywords: ['projects', 'jobs', 'workflow', 'delivery'],
      durationLabel: '05:24',
      videoUrl: environment.bmProjects,
      accentGradient:
        'linear-gradient(135deg, rgba(96, 165, 250, 0.24), rgba(14, 165, 233, 0.84))',
    },
    {
      videoId: 'bm-project-types',
      title: 'Project types',
      description:
        'Standardise reusable project structures so teams can launch consistent work faster.',
      module: 'Project types',
      category: 'Catalog',
      level: 'Advanced',
      keywords: ['project types', 'templates', 'reusable', 'standardisation'],
      durationLabel: '04:53',
      videoUrl: environment.bmProjectTypes,
      accentGradient:
        'linear-gradient(135deg, rgba(192, 132, 252, 0.24), rgba(124, 58, 237, 0.84))',
    },
    {
      videoId: 'bm-book-projects',
      title: 'Book projects',
      description:
        'Coordinate booked work, timelines, and team availability to keep schedules visible and actionable.',
      module: 'Book projects',
      category: 'Operations',
      level: 'Advanced',
      keywords: ['book projects', 'schedule', 'calendar', 'planning'],
      durationLabel: '03:59',
      videoUrl: environment.bmBookProjects,
      accentGradient:
        'linear-gradient(135deg, rgba(250, 204, 21, 0.24), rgba(249, 115, 22, 0.86))',
    },
    {
      videoId: 'bm-quotes',
      title: 'Quotes',
      description:
        'Draft, refine, and issue quotes using project data, pricing profiles, and reusable content.',
      module: 'Quotes',
      category: 'Finance',
      level: 'Core workflow',
      keywords: ['quotes', 'estimating', 'pricing', 'proposal'],
      durationLabel: '05:11',
      videoUrl: environment.bmQuotes,
      accentGradient:
        'linear-gradient(135deg, rgba(45, 212, 191, 0.24), rgba(20, 184, 166, 0.84))',
    },
    {
      videoId: 'bm-invoices',
      title: 'Invoices',
      description:
        'Generate invoices from approved work, review line items, and keep billing moving cleanly.',
      module: 'Invoices',
      category: 'Finance',
      level: 'Core workflow',
      keywords: ['invoices', 'billing', 'payments', 'line items'],
      durationLabel: '04:26',
      videoUrl: environment.bmInvoices,
      accentGradient:
        'linear-gradient(135deg, rgba(167, 139, 250, 0.24), rgba(236, 72, 153, 0.82))',
    },
  ];

  listExploreVideos(params: {
    page: number;
    limit: number;
    q?: string;
  }): Observable<ExploreVideosResult> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, params.limit || 8);
    const query = normalizeToken(params.q);
    const filteredVideos = this.videos.filter((video) =>
      this.matchesQuery(video, query),
    );
    const start = (page - 1) * limit;
    const items = filteredVideos.slice(start, start + limit);

    return of({
      items: [...items],
      page,
      limit,
      total: filteredVideos.length,
    }).pipe(delay(this.pageDelayMs));
  }

  private matchesQuery(video: BmExploreVideo, query: string): boolean {
    if (!query) return true;

    const haystack = [
      video.title,
      video.description,
      video.module,
      video.category,
      video.level,
      ...video.keywords,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  }
}
