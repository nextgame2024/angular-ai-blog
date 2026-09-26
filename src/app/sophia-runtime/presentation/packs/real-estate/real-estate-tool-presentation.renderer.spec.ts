import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SophiaSessionFacade } from '../../../services/sophia-session.facade';
import { SophiaPresentationMediaPolicy } from '../../sophia-presentation-media-policy';
import { SOPHIA_PRESENTATION_MEDIA_HOSTS } from '../../sophia-tool-presentation.types';
import { RealEstateToolPresentationRenderer } from './real-estate-tool-presentation.renderer';

describe('RealEstateToolPresentationRenderer', () => {
  let renderer: RealEstateToolPresentationRenderer;
  let sessions: {
    session: ReturnType<typeof signal>;
    executeTool: jasmine.Spy;
    executeRuntimeTool: jasmine.Spy;
    confirmActionReview: jasmine.Spy;
    cancelActionReview: jasmine.Spy;
    showError: jasmine.Spy;
  };

  beforeEach(() => {
    sessions = {
      session: signal(null),
      executeTool: jasmine.createSpy('executeTool').and.resolveTo(undefined),
      executeRuntimeTool: jasmine.createSpy('executeRuntimeTool').and.resolveTo({}),
      confirmActionReview: jasmine.createSpy('confirmActionReview').and.resolveTo(undefined),
      cancelActionReview: jasmine.createSpy('cancelActionReview').and.resolveTo(undefined),
      showError: jasmine.createSpy('showError'),
    };
    TestBed.configureTestingModule({
      providers: [
        RealEstateToolPresentationRenderer,
        SophiaPresentationMediaPolicy,
        {
          provide: SOPHIA_PRESENTATION_MEDIA_HOSTS,
          useValue: ['media.example.com'],
        },
        {
          provide: SophiaSessionFacade,
          useValue: sessions,
        },
      ],
    });
    renderer = TestBed.inject(RealEstateToolPresentationRenderer);
  });

  it('maps pack fields to generic blocks and removes non-allowlisted media', () => {
    const view = renderer.render('getPropertyDetails', {
      property: property([
        { mediaId: 'safe', url: 'https://media.example.com/one.jpg', altText: 'Front' },
        { mediaId: 'blocked', url: 'https://evil.test/tracker.jpg', altText: 'Tracker' },
      ]),
    });

    expect(view?.rendererKey).toBe('real-estate-presentation-v1');
    expect(view?.blocks.map((block) => block.type)).toEqual([
      'detail-card',
      'media-gallery',
    ]);
    const gallery = view?.blocks.find((block) => block.type === 'media-gallery');
    expect(gallery?.media.map((item) => item.mediaId)).toEqual(['safe']);
  });

  it('renders all authoritative future availability without a current-month filter', () => {
    renderer.render('getPropertyDetails', { property: property([]) });
    const view = renderer.render('getInspectionSlots', {
      slots: [
        slot('slot-near', '2030-01-10T01:00:00.000Z'),
        slot('slot-later', '2030-08-10T01:00:00.000Z'),
      ],
    });
    const availability = view?.blocks.find(
      (block) => block.type === 'availability-list',
    );
    expect(availability?.rows.map((row) => row.id)).toEqual([
      'slot-near',
      'slot-later',
    ]);
  });

  it('does not mislabel provider acceptance as recipient delivery', () => {
    const view = renderer.render('bookInspection', {
      booking: {
        bookingId: 'booking-12345678',
        customerName: 'A Customer',
        customerEmail: 'customer@example.com',
        propertyAddress: '1 Example Street',
        startsAtLabel: 'Monday 10:00 am',
        confirmationEmail: { status: 'provider_accepted' },
      },
    });
    const status = view?.blocks.find((block) => block.type === 'operation-status');
    expect(status?.status).toBe('processing');
    expect(status?.summary).toContain('not yet verified');
  });

  it('cancels the durable review when the customer dismisses it', async () => {
    sessions.session.set({ sessionId: 'session-1' });
    renderer.render('reviewInspectionBooking', { bookingReview: review() });

    const view = await renderer.handleAction({
      actionId: 'real-estate.cancel-review',
      label: 'Cancel review',
    });

    expect(sessions.cancelActionReview).toHaveBeenCalledOnceWith('session-1', review().reviewId);
    expect(view).toBeNull();
  });
});

function review() {
  return {
    reviewId: 'review-1',
    mode: 'new',
    propertyId: 'property-1',
    slotId: 'slot-1',
    confirmedStartsAt: '2030-01-10T01:00:00.000Z',
    propertyAddress: '1 Example Street',
    startsAtLabel: 'Thursday 11:00 am',
    customerName: 'A Customer',
    customerEmail: 'customer@example.com',
  };
}

function property(media: unknown[]) {
  return {
    propertyId: 'property-1',
    listingType: 'rent',
    propertyType: 'unit',
    title: 'Example unit',
    address: '1 Example Street',
    suburb: 'Brisbane',
    city: 'Brisbane',
    state: 'QLD',
    postcode: '4000',
    priceDisplay: '$600 per week',
    bedrooms: 2,
    bathrooms: 1,
    carSpaces: 1,
    description: 'Structured description',
    media,
  };
}

function slot(slotId: string, startsAt: string) {
  return {
    slotId,
    propertyId: 'property-1',
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + 30 * 60_000).toISOString(),
    capacity: 10,
    placesAvailable: 4,
  };
}
