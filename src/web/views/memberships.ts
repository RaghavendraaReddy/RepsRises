import { AUDIENCE_INFO } from '../../shared/audience.js';
import { effectiveMonthly, money, paymentSchedule, savingVsMonthly, totalDue } from '../../shared/marketplace/pricing.js';
import { DURATIONS, EMPTY_QUERY, serializeGymQuery } from '../../shared/marketplace/search.js';
import type { Gym, MembershipPlan } from '../../shared/marketplace/types.js';
import { h, replace } from '../core/dom.js';
import { load, market } from '../core/market.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { button, eyebrow, linkButton } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { audienceSwitch, demoBadge, notice, sectionHead } from '../ui/market-ui.js';
import { compareToggle } from './gyms.js';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function membershipsView(context: ViewContext): View {
  const audience = store.audience();
  const months = Number(context.query.get('months')) || 0;
  const city = context.query.get('city') ?? store.local.location?.cityId ?? '';

  // 1. The visitor's own comparison (up to four plans, from any gyms).
  const compareBox = h('div', { class: 'stack' });
  const drawCompare = () => {
    const items = store.local.compare;
    if (!items.length) {
      replace(compareBox, h('div', { class: 'empty' }, h('h3', { class: 'title' }, 'Nothing to compare yet'),
        h('p', { class: 'body' }, 'Open a gym and press Compare on any plan. You can compare up to four plans from different gyms.'), linkButton('Discover gyms', '#/gyms', { variant: 'ghost', iconAfter: 'arrow' })));
      return;
    }
    void load(compareBox, () => Promise.all(items.map(item => market.gym(item.gymId).then(data => ({ gym: data.gym, plan: data.gym.memberships.find(plan => plan.id === item.planId) })).catch(() => ({ gym: null, plan: undefined })))), rows => {
      const valid = rows.filter((row): row is { gym: Gym; plan: MembershipPlan } => Boolean(row.gym && row.plan));
      if (!valid.length) return h('p', { class: 'muted' }, 'The plans you saved are no longer listed.');
      const lines: [string, (gym: Gym, plan: MembershipPlan) => string][] = [
        ['Gym', gym => `${gym.name}, ${gym.area}`],
        ['Duration', (_g, plan) => plural(plan.months, 'month')],
        ['Membership total', (gym, plan) => money(plan.price, gym.currency)],
        ['Per month', (gym, plan) => money(effectiveMonthly(plan), gym.currency)],
        ['Saving vs that gym’s monthly price', (gym, plan) => { const saving = savingVsMonthly(gym, plan); return saving ? `${money(saving.amount, gym.currency)} (${saving.percent}%)` : '—'; }],
        ['Joining fee', (gym, plan) => plan.joiningFee ? money(plan.joiningFee, gym.currency) : 'None'],
        ['Deposit', (gym, plan) => plan.deposit ? money(plan.deposit, gym.currency) : 'None'],
        ['Total due', (gym, plan) => money(totalDue(plan).total, gym.currency)],
        ['Payment schedule', (gym, plan) => paymentSchedule(plan, gym.currency)],
        ['Includes', (_g, plan) => plan.includes.join(', ')],
        ['Personal training', (_g, plan) => plan.ptSessions ? plural(plan.ptSessions, 'session') : 'Not included'],
        ['Renewal', (_g, plan) => plan.renewal],
        ['Cancellation', (_g, plan) => plan.cancellation],
        ['Offer', (_g, plan) => plan.offer ? `${plan.offer.label}, until ${date(plan.offer.validUntil)}` : 'None'],
      ];
      return h('div', { class: 'stack' },
        h('div', { class: 'table-wrap' }, h('table', { class: 'data-table compare-table' },
          h('caption', { class: 'sr-only' }, 'Your membership comparison'),
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, ''), valid.map(row => h('th', { scope: 'col' }, row.plan.name, row.gym.demo ? h('span', { class: 'block-badge' }, demoBadge()) : null)))),
          h('tbody', null, lines.map(([label, value]) => h('tr', null, h('th', { scope: 'row' }, label), valid.map(row => h('td', null, value(row.gym, row.plan))))),
            h('tr', null, h('th', { scope: 'row' }, ''), valid.map(row => h('td', null, h('div', { class: 'stack', style: { '--stack': '8px' } },
              linkButton('Enquire', `#/enquire?kind=membership&gym=${row.gym.id}&plan=${row.plan.id}`, { variant: 'primary', size: 'small' }),
              button('Remove', () => { store.toggleCompare({ gymId: row.gym.id, planId: row.plan.id }); drawCompare(); }, { variant: 'ghost', size: 'small' })))))))),
        h('div', { class: 'row' }, button('Clear comparison', () => { store.clearCompare(); drawCompare(); }, { variant: 'ghost', size: 'small', icon: 'trash' })));
    });
  };
  drawCompare();

  // 2. Same duration across gyms, sorted by price. No "best value" labels: the numbers speak.
  const durationBox = h('div');
  const durationControls = h('div', { class: 'row duration-chips', role: 'group', 'aria-label': 'Duration' }, DURATIONS.map(value => h('a', { class: 'chip', href: `#/memberships?months=${value}${city ? `&city=${city}` : ''}`, 'aria-pressed': String(value === months) }, plural(value, 'month'))));
  const query = serializeGymQuery({ ...EMPTY_QUERY, audience, months: months || null, cityId: city || null, sort: 'price' });
  if (months) {
    void load(durationBox, () => market.gyms(query), data => data.results.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
      h('caption', { class: 'sr-only' }, `${plural(months, 'month')} memberships by price`),
      h('thead', null, h('tr', null, ['Gym', 'Area', 'Total', 'Per month', 'Billing', ''].map(text => h('th', { scope: 'col' }, text)))),
      h('tbody', null, data.results.map(result => {
        const plan = result.from!.plan;
        return h('tr', null, h('th', { scope: 'row' }, h('a', { href: `#/gyms/${result.gym.id}?section=plans` }, result.gym.name)), h('td', null, result.gym.area),
          h('td', { class: 'numeral-cell' }, money(plan.price, result.gym.currency)), h('td', { class: 'numeral-cell' }, money(effectiveMonthly(plan), result.gym.currency)),
          h('td', null, plan.billing === 'upfront' || plan.months === 1 ? 'Upfront' : 'Monthly'), h('td', null, compareToggle(result.gym.id, plan.id)));
      })))) : h('p', { class: 'muted' }, `No gym offers a ${plural(months, 'month')} plan for ${AUDIENCE_INFO[audience].label.toLowerCase()}${city ? ' in this city' : ''}.`));
  } else durationBox.append(h('p', { class: 'small muted' }, 'Choose a duration to see every gym’s price for it.'));

  // 3. Offers currently listed by gyms.
  const offersBox = h('div');
  void load(offersBox, () => market.gyms(serializeGymQuery({ ...EMPTY_QUERY, audience, cityId: city || null, sort: 'name' })).then(async data => {
    const details = await Promise.all(data.results.map(result => market.gym(result.gym.id)));
    const today = new Date().toISOString().slice(0, 10);
    return details.flatMap(({ gym }) => gym.memberships.filter(plan => plan.offer && plan.offer.validUntil >= today && plan.audiences.includes(audience)).map(plan => ({ gym, plan })));
  }), offers => offers.length ? h('ul', { class: 'offer-grid', role: 'list' }, offers.map(({ gym, plan }) => h('li', { class: 'offer-card' },
    h('div', { class: 'row' }, h('p', { class: 'tag' }, `${gym.area}`), gym.demo ? demoBadge('Demo offer') : null),
    h('p', { class: 'title' }, gym.name), h('p', { class: 'small' }, `${plan.name} · ${money(plan.price, gym.currency)} total`),
    h('p', { class: 'offer small' }, h('strong', null, plan.offer!.label)), h('p', { class: 'small muted' }, `Valid until ${date(plan.offer!.validUntil)}. ${plan.offer!.terms}`),
    h('div', { class: 'row' }, linkButton('See plan', `#/gyms/${gym.id}?section=plans`, { variant: 'ghost', size: 'small' }), compareToggle(gym.id, plan.id)))))
    : h('p', { class: 'muted' }, 'No current offers for this audience.'));

  const cityChips = h('div', { class: 'row', role: 'group', 'aria-label': 'City' });
  void market.info().then(info => cityChips.append(
    h('a', { class: 'chip', href: `#/memberships${months ? `?months=${months}` : ''}`, 'aria-pressed': String(!city) }, 'All cities'),
    ...info.cities.map(item => h('a', { class: 'chip', href: `#/memberships?city=${item.id}${months ? `&months=${months}` : ''}`, 'aria-pressed': String(item.id === city) }, item.name)))).catch(() => undefined);

  const el = h('div', { class: 'page surface-light memberships' }, h('div', { class: 'container stack', style: { '--stack': '56px' } },
    h('header', { class: 'page-head' }, eyebrow('Memberships & offers'), h('h1', { class: 'display' }, 'Compare terms, ', h('em', null, 'not slogans.')),
      h('p', { class: 'lead' }, 'Totals, monthly equivalents, fees, deposits, renewal and cancellation, side by side. Every price comes from the gym’s own listing.'), h('div', { class: 'row' }, audienceSwitch())),
    notice('Prices and offers on this page are demonstration data. In a live deployment they come from each gym and are confirmed by the gym before you pay.', 'warn'),
    h('section', { class: 'stack', 'aria-labelledby': 'cmp' }, sectionHead({ eyebrow: 'Your comparison', title: 'Side by side', id: 'cmp' }), compareBox),
    h('section', { class: 'stack', 'aria-labelledby': 'dur' }, sectionHead({ eyebrow: 'By duration', title: 'One term, every gym', id: 'dur', lead: 'Sorted by price. Check what each plan includes before deciding.' }), cityChips, durationControls, durationBox),
    h('section', { class: 'stack', 'aria-labelledby': 'off' }, sectionHead({ eyebrow: 'Offers', title: 'Current offers', id: 'off', lead: 'Only offers with an end date and published terms are shown.' }), offersBox),
    h('p', { class: 'small muted' }, icon('info'), ' Icarus does not take payments. Enquiries go to the gym, which confirms the price and start date.')));
  return { el, title: 'Memberships & offers', surface: 'light', nav: 'memberships' };
}
