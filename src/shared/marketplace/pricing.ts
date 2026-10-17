import type { Currency, Gym, MembershipPlan, PackageTemplate, Professional, Quote } from './types.js';

const LOCALE: Record<Currency, string> = { INR: 'en-IN', GBP: 'en-GB', USD: 'en-US', EUR: 'en-IE' };

export function money(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE[currency], { style: 'currency', currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
}

/** Price per month across the term, ignoring one-off fees. */
export function effectiveMonthly(plan: MembershipPlan): number {
  return Math.round((plan.price / plan.months) * 100) / 100;
}

/** Everything payable over the term: membership, joining fee and refundable deposit shown separately. */
export function totalDue(plan: MembershipPlan) {
  return { membership: plan.price, joiningFee: plan.joiningFee, deposit: plan.deposit, total: plan.price + plan.joiningFee + plan.deposit };
}

/** What is charged when, so the user knows the payment schedule before enquiring. */
export function paymentSchedule(plan: MembershipPlan, currency: Currency): string {
  const fees = plan.joiningFee + plan.deposit;
  const feeText = fees ? ` plus ${money(fees, currency)} at sign-up (${[plan.joiningFee ? `${money(plan.joiningFee, currency)} joining fee` : '', plan.deposit ? `${money(plan.deposit, currency)} refundable deposit` : ''].filter(Boolean).join(', ')})` : '';
  return plan.billing === 'upfront' || plan.months === 1
    ? `${money(plan.price, currency)} paid at the start${feeText}.`
    : `${plan.months} monthly payments of ${money(effectiveMonthly(plan), currency)}${feeText}.`;
}

/**
 * Saving compared with paying this gym's own one-month price for the same number of months.
 * Returns null when the gym has no one-month plan to compare against, so no discount is ever invented.
 */
export function savingVsMonthly(gym: Gym, plan: MembershipPlan): { amount: number; percent: number } | null {
  const monthly = gym.memberships.find(item => item.months === 1 && item.audiences.some(audience => plan.audiences.includes(audience)));
  if (!monthly || plan.months === 1) return null;
  const baseline = monthly.price * plan.months;
  const amount = baseline - plan.price;
  if (amount <= 0) return null;
  return { amount, percent: Math.round((amount / baseline) * 100) };
}

/** Lowest effective monthly price among plans that suit the audience and duration filter. */
export function fromPrice(gym: Gym, filter: (plan: MembershipPlan) => boolean = () => true): { plan: MembershipPlan; monthly: number } | null {
  let best: { plan: MembershipPlan; monthly: number } | null = null;
  for (const plan of gym.memberships.filter(filter)) {
    const monthly = effectiveMonthly(plan);
    if (!best || monthly < best.monthly) best = { plan, monthly };
  }
  return best;
}

/** A transparent quote for a coaching package, built only from the professionals' own rates. */
export function packageQuote(template: PackageTemplate, trainer: Professional | null, nutritionist: Professional | null): Quote | null {
  const currency = trainer?.currency ?? nutritionist?.currency;
  if (!currency) return null;
  const lines = [];
  if (template.trainingSessions) {
    if (!trainer) return null;
    lines.push({ label: `${template.trainingSessions} training sessions × ${money(trainer.rate, currency)}`, amount: template.trainingSessions * trainer.rate });
  }
  if (template.nutritionConsults) {
    if (!nutritionist) return null;
    lines.push({ label: `${template.nutritionConsults} nutrition consultations × ${money(nutritionist.rate, currency)}`, amount: template.nutritionConsults * nutritionist.rate });
    if (template.mealPlanning && nutritionist.mealPlanFee) {
      const months = Math.max(1, Math.round(template.weeks / 4));
      lines.push({ label: `Meal planning, ${months} month${months === 1 ? '' : 's'} × ${money(nutritionist.mealPlanFee, currency)}`, amount: months * nutritionist.mealPlanFee });
    }
  }
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return { currency, lines, total, note: 'Estimate from each professional’s listed rate. The provider confirms the final price before you pay anything.' };
}
