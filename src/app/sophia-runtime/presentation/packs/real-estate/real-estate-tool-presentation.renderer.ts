import { inject, Injectable } from '@angular/core';

import { SophiaSessionFacade } from '../../../services/sophia-session.facade';
import { SophiaPresentationMediaPolicy } from '../../sophia-presentation-media-policy';
import type {
  SophiaPresentationAction,
  SophiaPresentationBlock,
  SophiaPresentationDocument,
  SophiaPresentationMedia,
  SophiaStatusBlock,
  SophiaToolPresentationRenderer,
} from '../../sophia-tool-presentation.types';
import type {
  RealEstateBooking,
  RealEstateBookingReview,
  RealEstateInspectionSlot,
  RealEstateKnowledgeItem,
  RealEstateProperty,
} from './real-estate-presentation.types';

export const REAL_ESTATE_TOOL_ACTIVITY_LABELS = {
  rendererKey: 'real-estate-presentation-v1',
  labels: {
    searchProperties: 'Finding suitable properties',
    getPropertyDetails: 'Loading property details',
    getInspectionSlots: 'Checking inspection times',
    bookInspection: 'Confirming inspection',
    reviewInspectionBooking: 'Reviewing confirmation details',
    reviewInspectionEmailResend: 'Reviewing confirmation details',
    resendInspectionConfirmation: 'Resending confirmation email',
    showPropertyPhoto: 'Opening property photo',
    searchAgencyKnowledge: 'Checking agency guidance',
  },
} as const;

export const REAL_ESTATE_MEDIA_HOSTS = [
  'files-nodejs-api.s3.ap-southeast-2.amazonaws.com',
] as const;

const TOOL_NAMES = [
  'searchProperties',
  'getPropertyDetails',
  'showPropertyPhoto',
  'closePropertyView',
  'getInspectionSlots',
  'reviewInspectionBooking',
  'reviewInspectionEmailResend',
  'bookInspection',
  'resendInspectionConfirmation',
  'searchAgencyKnowledge',
] as const;

@Injectable()
export class RealEstateToolPresentationRenderer
  implements SophiaToolPresentationRenderer
{
  private readonly sessions = inject(SophiaSessionFacade);
  private readonly mediaPolicy = inject(SophiaPresentationMediaPolicy);
  private properties: RealEstateProperty[] = [];
  private selectedProperty: RealEstateProperty | null = null;
  private slots: RealEstateInspectionSlot[] = [];
  private booking: RealEstateBooking | null = null;
  private review: RealEstateBookingReview | null = null;
  private reviewManuallyEdited = false;
  private reviewConfirmedByUser = false;

  readonly manifest = {
    rendererKey: 'real-estate-presentation-v1',
    toolNames: TOOL_NAMES,
  } as const;

  render(toolName: string, output: unknown): SophiaPresentationDocument | null {
    const payload = record(output);
    if (!payload) return this.currentDocument();

    switch (toolName) {
      case 'searchProperties':
        this.properties = array(payload['properties']).filter(isProperty);
        this.selectedProperty = null;
        this.slots = [];
        this.booking = null;
        this.review = null;
        return this.propertyListDocument();
      case 'getPropertyDetails':
      case 'showPropertyPhoto': {
        const property = payload['property'];
        if (!isProperty(property)) return this.currentDocument();
        this.selectedProperty = property;
        this.properties = [];
        this.slots = [];
        this.booking = null;
        this.review = null;
        return this.propertyDetailDocument(
          toolName === 'showPropertyPhoto'
            ? Math.max(1, numberValue(payload['photoNumber']) || 1)
            : undefined,
        );
      }
      case 'closePropertyView':
        if (payload['closePropertyView'] === true) this.clear();
        return null;
      case 'getInspectionSlots':
        this.slots = array(payload['slots']).filter(isSlot).sort(
          (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt),
        );
        this.booking = null;
        return this.propertyDetailDocument();
      case 'reviewInspectionBooking':
      case 'reviewInspectionEmailResend':
        if (isReview(payload['bookingReview'])) {
          this.review = payload['bookingReview'];
          this.reviewManuallyEdited = false;
          this.reviewConfirmedByUser = false;
        }
        return this.reviewDocument();
      case 'bookInspection':
        if (isBooking(payload['booking'])) this.booking = payload['booking'];
        this.review = null;
        return this.bookingDocument();
      case 'resendInspectionConfirmation': {
        const confirmation = record(payload['confirmationEmail']);
        if (this.booking && confirmation) {
          this.booking = {
            ...this.booking,
            customerEmail: text(confirmation['customerEmail']) || this.booking.customerEmail,
            confirmationEmail: {
              status: text(confirmation['status']) || 'queued',
              customerEmail: text(confirmation['customerEmail']) || undefined,
              message: text(confirmation['message']) || undefined,
            },
          };
        }
        this.review = null;
        return this.bookingDocument();
      }
      case 'searchAgencyKnowledge':
        return this.knowledgeDocument(
          array(payload['results']).filter(isKnowledge),
        );
      default:
        return this.currentDocument();
    }
  }

  async prepareToolInput(
    sessionId: string,
    toolName: string,
    providerInput: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (
      toolName !== 'bookInspection' &&
      toolName !== 'resendInspectionConfirmation'
    ) {
      return providerInput;
    }
    const currentReview = this.review;
    if (!currentReview) throw new Error('Display the booking details before sending.');

    const providerName = text(providerInput['customerName']);
    const providerEmail = text(providerInput['customerEmail']);
    if (!this.reviewManuallyEdited) {
      const updated = {
        ...currentReview,
        customerName: providerName || currentReview.customerName,
        customerEmail: providerEmail || currentReview.customerEmail,
      };
      if (
        updated.customerName !== currentReview.customerName ||
        updated.customerEmail.toLowerCase() !== currentReview.customerEmail.toLowerCase()
      ) {
        this.review = updated;
        this.reviewConfirmedByUser = false;
        await this.syncReview(sessionId, updated);
        throw new Error(
          'The corrected details are now displayed. Ask the customer to check and confirm them before sending.',
        );
      }
    }
    if (!this.reviewConfirmedByUser) {
      throw new Error('Wait for the customer to use the displayed confirmation button before sending.');
    }

    const review = this.review;
    if (!review) throw new Error('The booking review is no longer available.');
    const customerName = review.customerName.trim();
    const customerEmail = review.customerEmail.trim().toLowerCase();
    if (customerName.length < 2) throw new Error('Enter the customer name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      throw new Error('Enter a valid confirmation email.');
    }
    const normalized = { ...review, customerName, customerEmail };
    this.review = normalized;
    const authoritative = await this.syncReview(sessionId, normalized);
    await this.sessions.confirmActionReview(sessionId, authoritative.reviewId);
    this.reviewManuallyEdited = false;
    this.reviewConfirmedByUser = false;

    return toolName === 'bookInspection'
      ? {
          ...providerInput,
          reviewId: authoritative.reviewId,
          propertyId: normalized.propertyId,
          slotId: normalized.slotId,
          confirmedStartsAt: normalized.confirmedStartsAt,
          propertyAddress: normalized.propertyAddress,
          startsAtLabel: normalized.startsAtLabel,
          customerName,
          customerEmail,
          confirmed: true,
        }
      : {
          ...providerInput,
          reviewId: authoritative.reviewId,
          bookingId: normalized.bookingId,
          customerName,
          customerEmail,
          propertyAddress: normalized.propertyAddress,
          startsAtLabel: normalized.startsAtLabel,
          confirmed: true,
        };
  }

  async handleAction(action: SophiaPresentationAction): Promise<SophiaPresentationDocument | null | void> {
    if (action.actionId === 'real-estate.select-property') {
      const propertyId = text(action.payload?.['propertyId']);
      const selected = this.properties.find((item) => item.propertyId === propertyId);
      if (!selected) return;
      this.selectedProperty = selected;
      this.slots = [];
      this.booking = null;
      this.review = null;
      return this.propertyDetailDocument();
    }
    if (action.actionId === 'real-estate.cancel-review') {
      await this.dismiss();
      return null;
    }
    if (action.actionId !== 'real-estate.confirm-review' || !this.review) return;

    const session = this.sessions.session();
    if (!session) return;
    this.reviewConfirmedByUser = true;
    const isResend = this.review.mode === 'resend';
    try {
      await this.sessions.executeTool({
        callId: `ui-confirm-${this.review.reviewId}-${Date.now()}`,
        name: isResend ? 'resendInspectionConfirmation' : 'bookInspection',
        arguments: isResend
          ? {
              bookingId: this.review.bookingId,
              customerName: this.review.customerName,
              customerEmail: this.review.customerEmail,
              propertyAddress: this.review.propertyAddress,
              startsAtLabel: this.review.startsAtLabel,
              confirmed: true,
            }
          : {
              propertyId: this.review.propertyId,
              slotId: this.review.slotId,
              confirmedStartsAt: this.review.confirmedStartsAt,
              propertyAddress: this.review.propertyAddress,
              startsAtLabel: this.review.startsAtLabel,
              customerName: this.review.customerName,
              customerEmail: this.review.customerEmail,
              confirmed: true,
            },
      });
    } catch (error) {
      this.reviewConfirmedByUser = false;
      this.sessions.showError(error, 'The booking could not be confirmed.');
    }
  }

  updateField(key: string, value: string): SophiaPresentationDocument | null | void {
    if (!this.review || (key !== 'customerName' && key !== 'customerEmail')) return;
    this.review = { ...this.review, [key]: value };
    this.reviewManuallyEdited = true;
    this.reviewConfirmedByUser = false;
    return this.reviewDocument();
  }

  clear(): void {
    this.properties = [];
    this.selectedProperty = null;
    this.slots = [];
    this.booking = null;
    this.review = null;
    this.reviewManuallyEdited = false;
    this.reviewConfirmedByUser = false;
  }

  async dismiss(): Promise<void> {
    const reviewId = this.review?.reviewId;
    const sessionId = this.sessions.session()?.sessionId;
    this.clear();
    if (reviewId && sessionId) {
      try {
        await this.sessions.cancelActionReview(sessionId, reviewId);
      } catch (error) {
        this.sessions.showError(error, 'The review could not be cancelled on the server.');
      }
    }
  }

  private currentDocument(): SophiaPresentationDocument | null {
    if (this.review) return this.reviewDocument();
    if (this.booking) return this.bookingDocument();
    if (this.selectedProperty) return this.propertyDetailDocument();
    if (this.properties.length) return this.propertyListDocument();
    return null;
  }

  private propertyListDocument(): SophiaPresentationDocument {
    return document([{
      type: 'item-list',
      eyebrow: 'Recommended options',
      title: `${this.properties.length} options found`,
      items: this.properties.map((property) => ({
        id: property.propertyId,
        title: displayAddress(property),
        subtitle: [property.propertyType, locality(property)].filter(Boolean).join(' · '),
        summary: facts(property),
        badge: property.priceDisplay || undefined,
        media: this.media(property)[0],
        action: {
          actionId: 'real-estate.select-property',
          label: `Open ${displayAddress(property)}`,
          payload: { propertyId: property.propertyId },
        },
      })),
    }]);
  }

  private propertyDetailDocument(photoNumber?: number): SophiaPresentationDocument {
    const property = this.selectedProperty;
    if (!property) return this.propertyListDocument();
    const media = this.media(property);
    if (photoNumber && media.length) {
      const index = Math.min(photoNumber - 1, media.length - 1);
      media.unshift(...media.splice(index, 1));
    }
    const blocks: SophiaPresentationBlock[] = [
      {
        type: 'detail-card',
        eyebrow: property.listingType === 'rent' ? 'For rent' : 'For sale',
        title: displayAddress(property),
        subtitle: locality(property),
        primaryText: property.priceDisplay || undefined,
        summary: property.description || undefined,
        fields: [
          { label: 'Bedrooms', value: count(property.bedrooms) },
          { label: 'Bathrooms', value: count(property.bathrooms) },
          { label: 'Car spaces', value: count(property.carSpaces) },
        ],
      },
    ];
    if (media.length) blocks.push({ type: 'media-gallery', title: displayAddress(property), media });
    if (this.slots.length) {
      blocks.push({
        type: 'availability-list',
        title: 'Available inspection times',
        rows: this.slots.map((slot) => ({
          id: slot.slotId,
          primary: slot.startsAtLabel || formatDateTime(slot.startsAt),
          secondary: slot.timeZone || 'Local time',
          status: `${slot.placesAvailable} places`,
        })),
      });
    }
    return document(blocks);
  }

  private reviewDocument(): SophiaPresentationDocument | null {
    const review = this.review;
    if (!review) return null;
    const resend = review.mode === 'resend';
    return document([{
      type: 'review-card',
      eyebrow: resend ? 'Confirm email resend' : 'Confirm booking details',
      title: resend ? 'Check recipient details' : 'Check booking details',
      prompt: 'Check the details and make any corrections before anything is sent.',
      fields: [
        { key: 'customerName', label: 'Name', value: review.customerName, inputType: 'text', autocomplete: 'off' },
        { key: 'customerEmail', label: 'Email', value: review.customerEmail, inputType: 'email', autocomplete: 'off' },
      ],
      facts: [
        { label: 'Property', value: review.propertyAddress },
        { label: 'Inspection', value: review.startsAtLabel },
      ],
      action: {
        actionId: 'real-estate.confirm-review',
        label: resend ? 'Confirm and send email' : 'Confirm and book inspection',
      },
      secondaryAction: {
        actionId: 'real-estate.cancel-review',
        label: 'Cancel review',
      },
    }]);
  }

  private bookingDocument(): SophiaPresentationDocument | null {
    const booking = this.booking;
    if (!booking) return null;
    const delivery = deliveryStatus(booking.confirmationEmail?.status);
    const block: SophiaStatusBlock = {
      type: 'operation-status',
      eyebrow: 'Inspection confirmed',
      title: booking.customerName || 'Booking confirmed',
      status: delivery.status,
      summary: delivery.message,
      details: [
        { label: 'Property', value: booking.propertyAddress || displayAddress(this.selectedProperty) },
        { label: 'Inspection', value: booking.startsAtLabel || (booking.startsAt ? formatDateTime(booking.startsAt) : 'Confirmed') },
        { label: 'Email', value: booking.customerEmail },
        { label: 'Reference', value: booking.bookingId.slice(0, 8).toUpperCase() },
      ],
    };
    return document([block]);
  }

  private knowledgeDocument(items: RealEstateKnowledgeItem[]): SophiaPresentationDocument {
    this.properties = [];
    this.selectedProperty = null;
    this.slots = [];
    this.booking = null;
    this.review = null;
    return document([{
      type: 'source-list',
      title: 'Approved business requirements',
      items: items.map((item) => ({
        id: item.knowledgeId,
        title: item.question,
        excerpt: item.answer,
        sourceRef: item.jurisdiction || item.category || undefined,
      })),
    }]);
  }

  private media(property: RealEstateProperty): SophiaPresentationMedia[] {
    return property.media
      .filter(isMedia)
      .map((item) => {
        const url = this.mediaPolicy.allow(item.url);
        return url ? {
          mediaId: item.mediaId,
          url,
          altText: item.altText || property.title || displayAddress(property),
        } : null;
      })
      .filter((item): item is SophiaPresentationMedia => item !== null);
  }

  private async syncReview(
    sessionId: string,
    review: RealEstateBookingReview,
  ): Promise<RealEstateBookingReview> {
    const output = await this.sessions.executeRuntimeTool(
      sessionId,
      review.mode === 'resend'
        ? 'reviewInspectionEmailResend'
        : 'reviewInspectionBooking',
      { ...review },
    );
    const payload = record(output);
    if (!isReview(payload?.['bookingReview'])) {
      throw new Error('The booking review could not be persisted.');
    }
    this.review = payload['bookingReview'];
    return this.review;
  }
}

function document(blocks: SophiaPresentationBlock[]): SophiaPresentationDocument {
  return { rendererKey: 'real-estate-presentation-v1', blocks };
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 4_000) : '';
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isProperty(value: unknown): value is RealEstateProperty {
  const item = record(value);
  return !!item && typeof item['propertyId'] === 'string' &&
    (item['listingType'] === 'sale' || item['listingType'] === 'rent') &&
    typeof item['title'] === 'string' && Array.isArray(item['media']);
}

function isSlot(value: unknown): value is RealEstateInspectionSlot {
  const item = record(value);
  return !!item && typeof item['slotId'] === 'string' &&
    typeof item['propertyId'] === 'string' && typeof item['startsAt'] === 'string' &&
    typeof item['endsAt'] === 'string' && typeof item['placesAvailable'] === 'number';
}

function isMedia(value: unknown): value is RealEstateProperty['media'][number] {
  const item = record(value);
  return !!item && typeof item['mediaId'] === 'string' && typeof item['url'] === 'string';
}

function isReview(value: unknown): value is RealEstateBookingReview {
  const item = record(value);
  return !!item && typeof item['reviewId'] === 'string' &&
    (item['mode'] === 'new' || item['mode'] === 'resend') &&
    typeof item['customerName'] === 'string' && typeof item['customerEmail'] === 'string' &&
    typeof item['propertyAddress'] === 'string' && typeof item['startsAtLabel'] === 'string';
}

function isBooking(value: unknown): value is RealEstateBooking {
  const item = record(value);
  return !!item && typeof item['bookingId'] === 'string' && typeof item['customerEmail'] === 'string';
}

function isKnowledge(value: unknown): value is RealEstateKnowledgeItem {
  const item = record(value);
  return !!item && typeof item['knowledgeId'] === 'string' &&
    typeof item['question'] === 'string' && typeof item['answer'] === 'string';
}

function displayAddress(property: RealEstateProperty | null): string {
  if (!property) return 'Selected property';
  return property.address || property.title;
}

function locality(property: RealEstateProperty): string {
  return [property.suburb, property.city, property.state, property.postcode]
    .filter(Boolean).join(' ');
}

function count(value: number | null | undefined): string {
  return typeof value === 'number' ? String(value) : 'Not provided';
}

function facts(property: RealEstateProperty): string {
  return [
    typeof property.bedrooms === 'number' ? `${property.bedrooms} bed` : '',
    typeof property.bathrooms === 'number' ? `${property.bathrooms} bath` : '',
    typeof property.carSpaces === 'number' ? `${property.carSpaces} car` : '',
  ].filter(Boolean).join(' · ');
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat('en-AU', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: 'numeric', minute: '2-digit',
      }).format(date);
}

function deliveryStatus(value: string | undefined): {
  status: SophiaStatusBlock['status'];
  message: string;
} {
  switch (value) {
    case 'delivered':
    case 'already_delivered':
      return { status: 'success', message: 'The confirmation email has verified delivery evidence.' };
    case 'provider_accepted':
    case 'sent':
    case 'already_sent':
      return { status: 'processing', message: 'The email provider accepted the confirmation; recipient delivery is not yet verified.' };
    case 'previewed':
      return { status: 'warning', message: 'A delivery preview was prepared; no recipient email was delivered.' };
    case 'failed':
      return { status: 'failed', message: 'The booking is confirmed, but email delivery needs attention.' };
    case 'outcome_unknown':
      return { status: 'unknown', message: 'The booking is confirmed, but the email submission outcome is unknown and will not be retried automatically.' };
    default:
      return { status: 'processing', message: 'The booking is confirmed and the confirmation workflow is still processing.' };
  }
}
