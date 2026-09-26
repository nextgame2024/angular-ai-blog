export interface RealEstateMedia {
  mediaId: string;
  url: string;
  altText?: string | null;
  sortOrder?: number;
}

export interface RealEstateProperty {
  propertyId: string;
  listingType: 'sale' | 'rent';
  propertyType?: string | null;
  title: string;
  address?: string | null;
  suburb?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  priceDisplay?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  carSpaces?: number | null;
  description?: string | null;
  features?: string[] | null;
  media: RealEstateMedia[];
}

export interface RealEstateInspectionSlot {
  slotId: string;
  propertyId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  placesAvailable: number;
  startsAtDateLabel?: string;
  startsAtTimeLabel?: string;
  startsAtLabel?: string;
  timeZone?: string;
}

export interface RealEstateBookingReview {
  reviewId: string;
  expiresAt?: string;
  mode: 'new' | 'resend';
  bookingId?: string;
  propertyId?: string;
  slotId?: string;
  confirmedStartsAt?: string;
  propertyAddress: string;
  startsAtLabel: string;
  customerName: string;
  customerEmail: string;
}

export interface RealEstateBooking {
  bookingId: string;
  propertyId?: string;
  slotId?: string;
  customerName?: string;
  customerEmail: string;
  status?: string;
  startsAt?: string;
  startsAtLabel?: string;
  propertyAddress?: string | null;
  propertySuburb?: string | null;
  propertyCity?: string | null;
  confirmationEmail?: {
    status: string;
    customerEmail?: string;
    message?: string;
  };
}

export interface RealEstateKnowledgeItem {
  knowledgeId: string;
  category?: string;
  question: string;
  answer: string;
  jurisdiction?: string | null;
}
