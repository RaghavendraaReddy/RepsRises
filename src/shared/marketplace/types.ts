import type { Audience } from '../fitness/types.js';

// Marketplace records. Every record carries `demo`: demonstration data must always be labelled
// as such in the interface. A live provider returns the same shapes with `demo: false`.

export type Currency = 'INR' | 'GBP' | 'USD' | 'EUR';

export type Area = { name: string; lat: number; lng: number; postcodes: string[] };
export type City = { id: string; name: string; region: string; country: string; currency: Currency; lat: number; lng: number; areas: Area[] };

export type GeoPoint = { lat: number; lng: number };
export type UserLocation = GeoPoint & { label: string; cityId: string | null; source: 'device' | 'search' };

export const FACILITIES = ['free-weights', 'machines', 'cardio', 'functional', 'pool', 'sauna', 'studio', 'boxing', 'climbing', 'sports-hall', 'showers', 'lockers', 'parking', 'childcare', 'cafe'] as const;
export type Facility = typeof FACILITIES[number];
export const FACILITY_LABEL: Record<Facility, string> = {
  'free-weights': 'Free weights', machines: 'Resistance machines', cardio: 'Cardio zone', functional: 'Functional training area', pool: 'Swimming pool', sauna: 'Sauna & steam',
  studio: 'Group studio', boxing: 'Boxing area', climbing: 'Climbing wall', 'sports-hall': 'Sports hall', showers: 'Showers', lockers: 'Lockers', parking: 'Parking', childcare: 'Childcare', cafe: 'Café',
};

export const GYM_CATEGORIES = ['strength', 'full-service', 'boutique', 'crossfit-style', 'family', 'wellness', 'sports'] as const;
export type GymCategory = typeof GYM_CATEGORIES[number];
export const CATEGORY_LABEL: Record<GymCategory, string> = {
  strength: 'Strength gym', 'full-service': 'Full-service club', boutique: 'Boutique studio', 'crossfit-style': 'Functional fitness', family: 'Family & youth sports', wellness: 'Wellness & active ageing', sports: 'Sports centre',
};

export const ACCESSIBILITY = ['step-free', 'accessible-changing', 'lift', 'hearing-loop', 'seated-equipment'] as const;
export type Accessibility = typeof ACCESSIBILITY[number];
export const ACCESSIBILITY_LABEL: Record<Accessibility, string> = {
  'step-free': 'Step-free entrance', 'accessible-changing': 'Accessible changing room', lift: 'Lift to all floors', 'hearing-loop': 'Hearing loop at reception', 'seated-equipment': 'Seated and assisted equipment',
};

export type MembershipPlan = {
  id: string;
  name: string;
  months: number;
  /** Total price for the whole term, in the gym's currency. */
  price: number;
  billing: 'upfront' | 'monthly';
  joiningFee: number;
  deposit: number;
  includes: string[];
  classesIncluded: boolean;
  ptSessions: number;
  audiences: Audience[];
  renewal: string;
  cancellation: string;
  offer: { label: string; validUntil: string; terms: string } | null;
};

export type GymImage = { src: string; alt: string; caption: string };

export type Gym = {
  id: string;
  demo: boolean;
  name: string;
  tagline: string;
  description: string;
  cityId: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
  categories: GymCategory[];
  facilities: Facility[];
  equipment: string[];
  classes: string[];
  hours: { weekdays: string; weekends: string; open24h: boolean; earlyOpen: boolean; lateClose: boolean };
  audiences: Audience[];
  accessibility: Accessibility[];
  images: GymImage[];
  currency: Currency;
  memberships: MembershipPlan[];
  trainerIds: string[];
  nutritionistIds: string[];
  policies: { cancellation: string; renewal: string; fees: string; eligibility: string; guardian: string | null };
  /** Only populated from a verified review source. Demonstration listings have none. */
  reviews: { source: string; rating: number; count: number; url: string } | null;
  contact: { method: 'enquiry'; phone: string | null; email: string | null; website: string | null };
};

export type Qualification = { name: string; issuer: string; verified: boolean };

export type Professional = {
  id: string;
  demo: boolean;
  role: 'trainer' | 'nutritionist';
  name: string;
  initials: string;
  cityId: string;
  areas: string[];
  gymIds: string[];
  formats: ('in-person' | 'online' | 'hybrid')[];
  specialties: string[];
  audiences: Audience[];
  experienceYears: number;
  qualifications: Qualification[];
  languages: string[];
  bio: string;
  /** Trainers: per session. Nutritionists: per consultation. */
  rate: number;
  mealPlanFee: number | null;
  currency: Currency;
  availability: string;
};

export type PackageTemplate = {
  id: string;
  name: string;
  summary: string;
  weeks: number;
  trainingSessions: number;
  nutritionConsults: number;
  mealPlanning: boolean;
  assessments: string;
  followUps: string;
  formats: ('in-person' | 'online' | 'hybrid')[];
  audiences: Audience[];
  includes: string[];
};

export type RequestKind = 'membership' | 'coaching' | 'enquiry' | 'support';
export type RequestStatus = 'received' | 'forwarded' | 'withdrawn';

export type QuoteLine = { label: string; amount: number };
export type Quote = { currency: Currency; lines: QuoteLine[]; total: number; note: string };
