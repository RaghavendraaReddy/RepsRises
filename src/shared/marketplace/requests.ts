import { PARTICIPANT_AGE_BANDS, requiresGuardian } from '../audience.js';
import type { Audience } from '../fitness/types.js';
import type { Quote, RequestKind, RequestStatus } from './types.js';

// A booking or enquiry request. Icarus records the request and (when configured) forwards it to the
// provider. It is never a confirmed booking: only the provider can confirm.

export type Format = 'in-person' | 'online' | 'hybrid';
export type RequestInput = {
  kind: RequestKind;
  audience: Audience;
  gymId: string | null;
  planId: string | null;
  packageId: string | null;
  trainerId: string | null;
  nutritionistId: string | null;
  format: Format | null;
  /** Neighbourhood for in-person sessions. */
  area: string | null;
  preferredDates: string[];
  preferredTime: 'morning' | 'afternoon' | 'evening' | 'any' | null;
  participantAgeBand: string | null;
  contact: { name: string; email: string; phone: string; preferred: 'email' | 'phone' };
  /** For children: the person in `contact` is the parent or guardian. No child name is collected. */
  guardian: { relationship: string; consent: boolean } | null;
  message: string;
  healthFlag: boolean;
  consent: { privacy: boolean; contact: boolean };
  /** Honeypot: must stay empty. */
  website: string;
};

export type RequestRecord = {
  ref: string;
  kind: RequestKind;
  status: RequestStatus;
  createdAt: string;
  summary: string;
  quote: Quote | null;
  forwarded: boolean;
};

export type FieldErrors = Partial<Record<string, string>>;

const EMAIL = /^[^\s@<>()[\],;:"]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const ID = /^[a-z0-9-]{2,60}$/;
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;
const nullableId = (value: unknown) => value === null || (typeof value === 'string' && ID.test(value));

/** Structural check at the trust boundary. Anything unexpected is rejected outright. */
export function isRequestInput(value: unknown): value is RequestInput {
  if (!isObject(value)) return false;
  const keys = ['kind', 'audience', 'gymId', 'planId', 'packageId', 'trainerId', 'nutritionistId', 'format', 'area', 'preferredDates', 'preferredTime', 'participantAgeBand', 'contact', 'guardian', 'message', 'healthFlag', 'consent', 'website'];
  if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !(key in value))) return false;
  const contact = value.contact, guardian = value.guardian, consent = value.consent;
  return ['membership', 'coaching', 'enquiry', 'support'].includes(value.kind as string) && ['kids', 'adults', 'older'].includes(value.audience as string) &&
    nullableId(value.gymId) && nullableId(value.planId) && nullableId(value.packageId) && nullableId(value.trainerId) && nullableId(value.nutritionistId) &&
    (value.format === null || ['in-person', 'online', 'hybrid'].includes(value.format as string)) && (value.area === null || text(value.area, 60)) &&
    Array.isArray(value.preferredDates) && value.preferredDates.length <= 3 && value.preferredDates.every(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) &&
    (value.preferredTime === null || ['morning', 'afternoon', 'evening', 'any'].includes(value.preferredTime as string)) &&
    (value.participantAgeBand === null || text(value.participantAgeBand, 10)) &&
    isObject(contact) && Object.keys(contact).length === 4 && text(contact.name, 80) && text(contact.email, 254) && text(contact.phone, 20) && (contact.preferred === 'email' || contact.preferred === 'phone') &&
    (guardian === null || (isObject(guardian) && Object.keys(guardian).length === 2 && text(guardian.relationship, 40) && typeof guardian.consent === 'boolean')) &&
    text(value.message, 1000) && typeof value.healthFlag === 'boolean' && text(value.website, 200) &&
    isObject(consent) && Object.keys(consent).length === 2 && typeof consent.privacy === 'boolean' && typeof consent.contact === 'boolean';
}

/** Field-level rules shared by the form (for instant feedback) and the server (for enforcement). */
export function validateRequest(input: RequestInput, today = new Date()): FieldErrors {
  const errors: FieldErrors = {};
  const guardianNeeded = requiresGuardian(input.audience);
  if (input.contact.name.trim().length < 2) errors['contact.name'] = guardianNeeded ? 'Enter the parent or guardian’s name.' : 'Enter your name.';
  if (!EMAIL.test(input.contact.email.trim())) errors['contact.email'] = 'Enter a valid email address.';
  if (input.contact.phone.trim() && !PHONE.test(input.contact.phone.trim())) errors['contact.phone'] = 'Enter a valid phone number, or leave it empty.';
  if (input.contact.preferred === 'phone' && !input.contact.phone.trim()) errors['contact.phone'] = 'Add a phone number, or choose email as your preferred contact.';
  if (!input.consent.privacy) errors['consent.privacy'] = 'Please confirm you have read how your details are used.';
  if (!input.consent.contact) errors['consent.contact'] = 'The provider needs your permission to contact you about this request.';
  if (input.kind === 'membership' && (!input.gymId || !input.planId)) errors.planId = 'Choose a membership.';
  if (input.kind === 'enquiry' && !input.gymId && !input.trainerId && !input.nutritionistId) errors.message = 'Choose who the enquiry is for.';
  if ((input.kind === 'enquiry' || input.kind === 'support') && input.message.trim().length < 10) errors.message = 'Write a short message (at least 10 characters).';
  if (input.kind === 'coaching') {
    if (!input.packageId) errors.packageId = 'Choose a coaching package.';
    if (!input.format) errors.format = 'Choose in-person, online or hybrid.';
  }
  if (input.participantAgeBand !== null && !PARTICIPANT_AGE_BANDS[input.audience].includes(input.participantAgeBand)) errors.participantAgeBand = 'Choose an age range from the list.';
  const start = new Date(today); start.setHours(0, 0, 0, 0);
  const limit = new Date(start); limit.setDate(limit.getDate() + 180);
  for (const date of input.preferredDates) {
    const value = new Date(`${date}T00:00:00`);
    if (Number.isNaN(value.getTime()) || value < start || value > limit) { errors.preferredDates = 'Choose dates between today and six months from now.'; break; }
  }
  if (guardianNeeded) {
    if (!input.guardian?.relationship.trim()) errors['guardian.relationship'] = 'Tell us your relationship to the child.';
    if (!input.guardian?.consent) errors['guardian.consent'] = 'Guardian consent is required for a child’s booking.';
    if (!input.participantAgeBand) errors.participantAgeBand = 'Choose the child’s age range.';
  }
  return errors;
}

export function emptyRequest(kind: RequestKind, audience: Audience): RequestInput {
  return {
    kind, audience, gymId: null, planId: null, packageId: null, trainerId: null, nutritionistId: null, format: null, area: null, preferredDates: [], preferredTime: null,
    participantAgeBand: null, contact: { name: '', email: '', phone: '', preferred: 'email' }, guardian: requiresGuardian(audience) ? { relationship: '', consent: false } : null,
    message: '', healthFlag: false, consent: { privacy: false, contact: false }, website: '',
  };
}
