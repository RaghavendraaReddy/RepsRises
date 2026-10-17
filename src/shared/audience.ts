import type { Audience } from './fitness/types.js';

// Audience policies in one place, so every screen and the server apply the same rules.
// These are product safeguards, not legal advice; local law may require more (see docs/PRIVACY.md).

export type AudienceInfo = {
  id: Audience;
  label: string;
  ages: string;
  headline: string;
  summary: string;
  focus: string[];
};

export const AUDIENCE_INFO: Record<Audience, AudienceInfo> = {
  kids: {
    id: 'kids', label: 'Kids', ages: 'Ages 5–17',
    headline: 'Active play, safely supervised.',
    summary: 'Sports, games and coordination with qualified, supervised providers. A parent or guardian manages bookings.',
    focus: ['Movement games and sports', 'Coordination and balance', 'Supervised, age-appropriate programmes'],
  },
  adults: {
    id: 'adults', label: 'Adults', ages: 'Ages 18–64',
    headline: 'Train for strength, shape and stamina.',
    summary: 'Gyms, memberships, strength and conditioning programmes, personal training and nutrition support.',
    focus: ['Strength and muscle', 'Fat loss and conditioning', 'Mobility, endurance and sport'],
  },
  older: {
    id: 'older', label: 'Older Adults', ages: 'Ages 65+',
    headline: 'Strength, balance and independence.',
    summary: 'Accessible facilities, balance and mobility work, and trainers experienced with older clients.',
    focus: ['Balance and fall prevention', 'Strength and mobility', 'Accessible, supportive facilities'],
  },
};

/** Bookings for children are made by a parent or guardian, who gives consent and is the only contact. */
export function requiresGuardian(audience: Audience) { return audience === 'kids'; }

/** Kids never get weight-loss goals, calorie targets or individual meal plans. */
export function allowsWeightLossGoals(audience: Audience) { return audience !== 'kids'; }
export function allowsMealPlans(audience: Audience) { return audience !== 'kids'; }

/** Shown wherever a programme or provider is chosen. */
export function safetyNote(audience: Audience): string {
  if (audience === 'kids') return 'Children should always exercise under the supervision of a responsible adult or a qualified, checked coach. Check with your child’s doctor before starting if they have a health condition.';
  if (audience === 'older') return 'If you have a heart, joint, balance or other health condition, speak to your doctor or physiotherapist before starting a new programme, and tell your trainer about it.';
  return 'If you have a medical condition, an injury or are pregnant, check with a health professional before starting a new programme.';
}

export const PARTICIPANT_AGE_BANDS: Record<Audience, string[]> = {
  kids: ['5–7', '8–10', '11–13', '14–17'],
  adults: ['18–29', '30–44', '45–64'],
  older: ['65–74', '75–84', '85+'],
};
