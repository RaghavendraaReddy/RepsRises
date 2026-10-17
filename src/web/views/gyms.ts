import { AUDIENCE_INFO, safetyNote } from '../../shared/audience.js';
import { formatDistance } from '../../shared/marketplace/geo.js';
import { effectiveMonthly, money, paymentSchedule, savingVsMonthly, totalDue } from '../../shared/marketplace/pricing.js';
import { DURATIONS, parseGymQuery, serializeGymQuery, type GymQuery } from '../../shared/marketplace/search.js';
import { ACCESSIBILITY_LABEL, CATEGORY_LABEL, FACILITIES, FACILITY_LABEL, GYM_CATEGORIES, type Facility, type GeoPoint, type Gym, type GymCategory, type MembershipPlan } from '../../shared/marketplace/types.js';
import { h, replace } from '../core/dom.js';
import { load, market, type GymSearch } from '../core/market.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { button, eyebrow, linkButton, toast } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { audienceSwitch, demoBadge, gymCard, locationPicker, notice, planPrice, proCard, saveButton } from '../ui/market-ui.js';
import { gymsHref } from './home.js';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function gymsView(context: ViewContext): View {
  const audience = store.audience();
  const query: GymQuery = { ...parseGymQuery(context.query), audience };
  const saved = store.local.location;
  if (!query.near && saved && !context.query.has('city')) { query.near = { lat: saved.lat, lng: saved.lng }; query.cityId = saved.cityId; }
  const label = context.query.get('label') ?? (query.near && saved ? saved.label : null);
  let mode: 'list' | 'map' = context.query.get('view') === 'map' ? 'map' : 'list';

  const apply = (change: Partial<GymQuery>) => {
    const next = { ...query, ...change };
    const params = serializeGymQuery(next);
    if (label && next.near) params.set('label', label);
    if (mode === 'map') params.set('view', 'map');
    context.navigate(`#/gyms?${params}`, true);
  };

  const results = h('div', { class: 'gym-results', 'aria-live': 'polite' });
  const count = h('p', { class: 'tag', role: 'status' });
  const render = (data: GymSearch) => {
    count.textContent = `${plural(data.total, 'gym')}${label ? ` near ${label}` : ''}`;
    if (!data.total) return h('div', { class: 'empty' }, h('h3', { class: 'title' }, 'No gyms match these filters'),
      h('p', { class: 'body' }, query.reviewed ? 'No listing has verified reviews yet. Icarus shows ratings only from a verified review source.' : 'Try a wider budget or distance, fewer facilities, or another area.'),
      button('Clear filters', () => apply({ ...clearFilters() }), { variant: 'ghost' }));
    return mode === 'map' ? mapPanel(data, query.near) : h('div', { class: 'gym-grid' }, data.results.map(result => gymCard(result.gym, result)));
  };
  void load(results, () => market.gyms(serializeGymQuery(query)), render, { loading: 'Finding gyms…' });

  const clearFilters = (): Partial<GymQuery> => ({ q: '', maxMonthly: null, minMonthly: null, months: null, facilities: [], categories: [], classes: false, trainers: false, open24h: false, earlyOpen: false, accessible: false, reviewed: false, radiusKm: null });
  const filters = filterPanel(query, apply, clearFilters);

  const viewToggle = h('div', { class: 'segmented view-toggle', role: 'group', 'aria-label': 'Display' },
    (['list', 'map'] as const).map(value => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(mode === value), onclick: () => { mode = value; apply({}); } }, icon(value === 'list' ? 'list' : 'map'), value === 'list' ? 'List' : 'Map')));

  const el = h('div', { class: 'page surface-light gyms' }, h('div', { class: 'container' },
    h('header', { class: 'page-head' }, eyebrow('Discover'), h('h1', { class: 'display' }, 'Find your ', h('em', null, 'gym.')),
      h('p', { class: 'lead' }, `Showing gyms and plans suited to ${AUDIENCE_INFO[audience].label.toLowerCase()}. Distances are from ${label ?? 'the place you choose'}.`),
      h('div', { class: 'row' }, audienceSwitch())),
    notice(['These are ', h('strong', null, 'demonstration listings'), ': fictional gyms in real neighbourhoods, so you can try every feature. A live deployment connects a verified gym directory.'], 'warn'),
    h('div', { class: 'gyms-location' }, locationPicker({ onPick: place => context.navigate(gymsHref(place), true), compact: true }),
      label ? h('p', { class: 'small' }, icon('pin'), ` ${label} `, h('button', { type: 'button', class: 'text-link small', onclick: () => { try { store.setLocation(null); } catch { /* ignore */ } context.navigate(`#/gyms`, true); } }, 'Clear location')) : null),
    h('div', { class: 'gyms-layout' },
      filters,
      h('div', { class: 'stack', style: { '--stack': '16px' } }, h('div', { class: 'row results-bar' }, count, h('div', { class: 'row' }, sortSelect(query, apply), viewToggle)), results))));
  return { el, title: 'Discover gyms', surface: 'light', nav: 'gyms' };
}

function sortSelect(query: GymQuery, apply: (change: Partial<GymQuery>) => void) {
  return h('label', { class: 'row small sort' }, 'Sort',
    h('select', { class: 'input select small', onchange: (event: Event) => apply({ sort: (event.target as HTMLSelectElement).value as GymQuery['sort'] }) },
      ([['distance', 'Nearest'], ['price', 'Lowest monthly price'], ['name', 'Name']] as const).map(([value, text]) => h('option', { value, selected: query.sort === value, disabled: value === 'distance' && !query.near }, text))));
}

function filterPanel(query: GymQuery, apply: (change: Partial<GymQuery>) => void, clear: () => Partial<GymQuery>) {
  const draft: GymQuery = structuredClone(query);
  const numberInput = (key: 'minMonthly' | 'maxMonthly', placeholder: string) => h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 0, step: 100, placeholder, value: draft[key] ?? '', 'aria-label': key === 'minMonthly' ? 'Minimum monthly price' : 'Maximum monthly price',
    onchange: (event: Event) => { const raw = (event.target as HTMLInputElement).value; draft[key] = raw === '' ? null : Math.max(0, Number(raw)); } });
  const check = (labelText: string, value: boolean, set: (on: boolean) => void) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: value, onchange: (event: Event) => set((event.target as HTMLInputElement).checked) }), labelText);
  const active = [query.q, query.maxMonthly !== null, query.minMonthly !== null, query.months, query.facilities.length, query.categories.length, query.classes, query.trainers, query.open24h, query.earlyOpen, query.accessible, query.reviewed, query.radiusKm].filter(Boolean).length;

  const form = h('form', { class: 'filters stack', style: { '--stack': '20px' }, onsubmit: (event: Event) => {
    event.preventDefault();
    if (draft.minMonthly !== null && draft.maxMonthly !== null && draft.minMonthly > draft.maxMonthly) { toast('The minimum price is higher than the maximum.', { kind: 'error' }); return; }
    apply(draft);
  } },
    h('div', { class: 'field' }, h('label', { for: 'gym-q' }, 'Gym name or area'), h('input', { id: 'gym-q', class: 'input', type: 'search', value: draft.q, maxlength: 80, oninput: (event: Event) => { draft.q = (event.target as HTMLInputElement).value; } })),
    h('fieldset', { class: 'field' }, h('legend', { class: 'label' }, 'Monthly price (₹)'), h('p', { class: 'hint' }, 'Effective monthly price across the term, before joining fees.'),
      h('div', { class: 'row range-row' }, numberInput('minMonthly', 'Min'), h('span', { 'aria-hidden': 'true' }, '–'), numberInput('maxMonthly', 'Max'))),
    h('div', { class: 'field' }, h('label', { for: 'gym-months' }, 'Membership duration'),
      h('select', { id: 'gym-months', class: 'input select', onchange: (event: Event) => { const v = (event.target as HTMLSelectElement).value; draft.months = v ? Number(v) : null; } },
        h('option', { value: '' }, 'Any duration'), DURATIONS.map(months => h('option', { value: String(months), selected: draft.months === months }, plural(months, 'month'))))),
    query.near ? h('div', { class: 'field' }, h('label', { for: 'gym-radius' }, 'Distance'),
      h('select', { id: 'gym-radius', class: 'input select', onchange: (event: Event) => { const v = (event.target as HTMLSelectElement).value; draft.radiusKm = v ? Number(v) : null; } },
        h('option', { value: '' }, 'Any distance'), [2, 5, 10, 25].map(km => h('option', { value: String(km), selected: draft.radiusKm === km }, `Within ${km} km`)))) : null,
    h('fieldset', { class: 'field' }, h('legend', { class: 'label' }, 'Type of gym'), h('div', { class: 'check-grid' }, GYM_CATEGORIES.map(item => check(CATEGORY_LABEL[item], draft.categories.includes(item), on => { draft.categories = on ? [...draft.categories, item] : draft.categories.filter(c => c !== item) as GymCategory[]; })))),
    h('fieldset', { class: 'field' }, h('legend', { class: 'label' }, 'Facilities'), h('div', { class: 'check-grid' }, FACILITIES.map(item => check(FACILITY_LABEL[item], draft.facilities.includes(item), on => { draft.facilities = on ? [...draft.facilities, item] : draft.facilities.filter(f => f !== item) as Facility[]; })))),
    h('fieldset', { class: 'field' }, h('legend', { class: 'label' }, 'Hours and services'), h('div', { class: 'check-grid' },
      check('Open 24 hours', draft.open24h, on => { draft.open24h = on; }), check('Opens by 6:00', draft.earlyOpen, on => { draft.earlyOpen = on; }),
      check('Group classes', draft.classes, on => { draft.classes = on; }), check('Personal trainers available', draft.trainers, on => { draft.trainers = on; }),
      check('Step-free access', draft.accessible, on => { draft.accessible = on; }), check('Verified ratings only', draft.reviewed, on => { draft.reviewed = on; }))),
    h('div', { class: 'row filter-actions' }, h('button', { type: 'submit', class: 'btn primary' }, 'Show gyms'), button('Clear', () => apply(clear()), { variant: 'ghost' })));

  // On small screens filters fold into a disclosure so results come first.
  const details = h('details', { class: 'filter-panel', open: window.matchMedia('(min-width: 961px)').matches },
    h('summary', null, icon('filter'), 'Filters', active ? h('span', { class: 'count-badge' }, String(active)) : null), form);
  return details;
}

/** Map view: real street tiles when a tile server is configured, otherwise a to-scale position plot. */
function mapPanel(data: GymSearch, near: GeoPoint | null) {
  const points = data.results.map(result => ({ id: result.gym.id, name: result.gym.name, lat: result.gym.lat, lng: result.gym.lng, distance: result.distanceKm }));
  const all = near ? [...points, { ...near }] : points;
  const lats = all.map(p => p.lat), lngs = all.map(p => p.lng);
  const centre = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
  const map = store.config?.map ?? null;
  const span = Math.max(Math.max(...lats) - Math.min(...lats), (Math.max(...lngs) - Math.min(...lngs)) * 0.9, 0.01);
  const zoom = Math.max(3, Math.min(15, Math.floor(Math.log2(360 / span)) - 1));
  const world = (lat: number, lng: number) => {
    const scale = 256 * 2 ** zoom, rad = (lat * Math.PI) / 180;
    return { x: ((lng + 180) / 360) * scale, y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale };
  };
  const width = 960, height = 560;
  const origin = world(centre.lat, centre.lng);
  const at = (lat: number, lng: number) => { const p = world(lat, lng); return { left: ((p.x - origin.x + width / 2) / width) * 100, top: ((p.y - origin.y + height / 2) / height) * 100 }; };

  const canvas = h('div', { class: `map-canvas${map ? ' tiles' : ' plot'}`, role: 'group', 'aria-label': map ? 'Map of gym locations' : 'Position plot of gym locations' });
  if (map) {
    const first = { x: Math.floor((origin.x - width / 2) / 256), y: Math.floor((origin.y - height / 2) / 256) };
    const last = { x: Math.floor((origin.x + width / 2) / 256), y: Math.floor((origin.y + height / 2) / 256) };
    for (let x = first.x; x <= last.x; x++) for (let y = first.y; y <= last.y; y++) {
      const src = map.tileUrl.replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y)).replace('{s}', 'a');
      const tile = h('img', { class: 'map-tile', src, alt: '', loading: 'lazy', width: 256, height: 256 });
      tile.style.setProperty('left', `${((x * 256 - origin.x + width / 2) / width) * 100}%`);
      tile.style.setProperty('top', `${((y * 256 - origin.y + height / 2) / height) * 100}%`);
      canvas.append(tile);
    }
  } else {
    canvas.append(h('div', { class: 'map-grid', 'aria-hidden': 'true' }));
  }
  if (near) {
    const pos = at(near.lat, near.lng);
    const you = h('span', { class: 'map-you', 'aria-label': 'Your search point', role: 'img' });
    you.style.setProperty('left', `${pos.left}%`); you.style.setProperty('top', `${pos.top}%`);
    canvas.append(you);
  }
  points.forEach((point, index) => {
    const pos = at(point.lat, point.lng);
    const pin = h('a', { class: 'map-pin', href: `#/gyms/${point.id}`, 'aria-label': `${point.name}${point.distance !== null ? `, ${formatDistance(point.distance)}` : ''}` }, h('span', null, String(index + 1)));
    pin.style.setProperty('left', `${pos.left}%`); pin.style.setProperty('top', `${pos.top}%`);
    canvas.append(pin);
  });
  return h('div', { class: 'map-panel' }, canvas,
    h('p', { class: 'small muted map-note' }, map ? map.attribution : 'Street map not configured for this deployment. Positions are drawn to scale relative to each other; gym locations are approximate area centres.'),
    h('ol', { class: 'map-legend', role: 'list' }, points.map((point, index) => h('li', null, h('span', { class: 'numeral' }, String(index + 1)), h('a', { href: `#/gyms/${point.id}` }, point.name), point.distance !== null ? h('span', { class: 'small muted' }, formatDistance(point.distance)) : null))));
}

const BILLING = (plan: MembershipPlan) => plan.billing === 'upfront' || plan.months === 1 ? 'Paid upfront' : 'Monthly payments';

export function gymView(context: ViewContext): View {
  const audience = store.audience();
  const el = h('div', { class: 'page surface-light gym-detail' });
  const body = h('div', { class: 'container' });
  el.append(body);
  void load(body, () => market.gym(context.params.id), ({ gym, trainers, nutritionists }) => {
    const plans = gym.memberships.filter(plan => plan.audiences.includes(audience)).sort((a, b) => a.months - b.months);
    const otherPlans = gym.memberships.length - plans.length;
    const suits = gym.audiences.includes(audience);
    document.title = `${gym.name} · Icarus`;
    const nodes: Node[] = [
      h('a', { class: 'text-link small back-link', href: '#/gyms' }, icon('arrow-left'), 'All gyms'),
      h('header', { class: 'gym-head' },
        h('div', { class: 'stack', style: { '--stack': '12px' } },
          h('div', { class: 'row' }, eyebrow(`${gym.area} · ${gym.categories.map(item => CATEGORY_LABEL[item]).join(' · ')}`), gym.demo ? demoBadge() : null),
          h('h1', { class: 'display' }, gym.name), h('p', { class: 'lead' }, gym.tagline)),
        h('div', { class: 'row gym-actions' }, saveButton('gyms', gym.id, gym.name),
          linkButton('Send an enquiry', `#/enquire?kind=enquiry&gym=${gym.id}`, { variant: 'ghost', icon: 'mail' }),
          plans.length ? linkButton('View plans', `#/gyms/${gym.id}?section=plans`, { variant: 'primary' }) : null)),
      gallery(gym),
      !suits ? notice(`${gym.name} does not list programmes for ${AUDIENCE_INFO[audience].label.toLowerCase()}. Switch audience to see its plans.`, 'warn') : null,
      h('div', { class: 'gym-columns' },
        h('div', { class: 'stack', style: { '--stack': '40px' } },
          h('section', { class: 'stack', 'aria-labelledby': 'about' }, h('h2', { class: 'eyebrow', id: 'about' }, 'About'), h('p', { class: 'body' }, gym.description)),
          facts('Facilities', gym.facilities.map(item => FACILITY_LABEL[item])),
          facts('Equipment', gym.equipment),
          facts('Classes', gym.classes.length ? gym.classes : ['No scheduled classes']),
          facts('Accessibility', gym.accessibility.length ? gym.accessibility.map(item => ACCESSIBILITY_LABEL[item]) : ['No accessibility features listed. Ask the gym before visiting.'])),
        h('aside', { class: 'gym-aside stack', 'aria-label': 'Location and hours' },
          h('div', { class: 'stack', style: { '--stack': '6px' } }, h('p', { class: 'eyebrow' }, 'Location'), h('p', { class: 'body' }, gym.address),
            h('a', { class: 'text-link small', href: `https://www.openstreetmap.org/directions?to=${gym.lat}%2C${gym.lng}`, target: '_blank', rel: 'noopener noreferrer' }, 'Directions to the area', icon('external')),
            gym.demo ? h('p', { class: 'small muted' }, 'Demo listing: the pin marks the neighbourhood, not a real venue.') : null),
          h('dl', { class: 'review-list' },
            h('div', null, h('dt', null, 'Weekdays'), h('dd', null, gym.hours.open24h ? 'Open 24 hours' : gym.hours.weekdays)),
            h('div', null, h('dt', null, 'Weekends'), h('dd', null, gym.hours.open24h ? 'Open 24 hours' : gym.hours.weekends))),
          h('div', { class: 'stack', style: { '--stack': '6px' } }, h('p', { class: 'eyebrow' }, 'Reviews'),
            gym.reviews ? h('p', { class: 'body' }, `${gym.reviews.rating.toFixed(1)} from ${gym.reviews.count} verified reviews · `, h('a', { href: gym.reviews.url, target: '_blank', rel: 'noopener noreferrer' }, gym.reviews.source))
              : h('p', { class: 'small muted' }, 'No verified reviews yet. Icarus shows ratings only from a verified review source, never written or seeded by us.')))),
      plans.length ? plansSection(gym, plans, otherPlans) : h('section', { id: 'plans' }, h('p', { class: 'muted' }, `No memberships for ${AUDIENCE_INFO[audience].label.toLowerCase()} at this gym.`)),
      trainers.length || nutritionists.length ? h('section', { class: 'stack', 'aria-labelledby': 'team' }, h('h2', { class: 'headline', id: 'team' }, 'Trainers and ', h('em', null, 'nutritionists')),
        h('div', { class: 'pro-grid' }, [...trainers, ...nutritionists].filter(pro => pro.audiences.includes(audience)).map(pro => proCard(pro))),
        linkButton('Build a coaching package', '#/coaching', { variant: 'ghost', iconAfter: 'arrow' })) : null,
      h('section', { class: 'stack', 'aria-labelledby': 'policies' }, h('h2', { class: 'headline', id: 'policies' }, 'Policies'),
        h('dl', { class: 'review-list policies' },
          h('div', null, h('dt', null, 'Cancellation'), h('dd', null, gym.policies.cancellation)),
          h('div', null, h('dt', null, 'Renewal'), h('dd', null, gym.policies.renewal)),
          h('div', null, h('dt', null, 'Fees'), h('dd', null, gym.policies.fees)),
          h('div', null, h('dt', null, 'Eligibility'), h('dd', null, gym.policies.eligibility)),
          gym.policies.guardian ? h('div', null, h('dt', null, 'Parents and guardians'), h('dd', null, gym.policies.guardian)) : null)),
      notice(safetyNote(audience), 'safety'),
    ].filter((node): node is HTMLElement => Boolean(node));
    queueMicrotask(() => { if (context.query.get('section') === 'plans') document.getElementById('plans')?.scrollIntoView({ block: 'start' }); });
    return nodes;
  });
  return { el, title: 'Gym', surface: 'light', nav: 'gyms' };
}

function facts(title: string, items: string[]) {
  return h('section', { class: 'stack', style: { '--stack': '10px' } }, h('h2', { class: 'eyebrow' }, title), h('ul', { class: 'fact-list', role: 'list' }, items.map(item => h('li', null, item))));
}

function gallery(gym: Gym) {
  if (!gym.images.length) return h('p', { class: 'small muted' }, 'No photos provided.');
  let index = 0;
  const main = h('img', { src: gym.images[0].src, alt: gym.images[0].alt, width: 900, height: 600, decoding: 'async' });
  const caption = h('figcaption', { class: 'small muted' }, gym.images[0].caption);
  const show = (next: number) => {
    index = (next + gym.images.length) % gym.images.length;
    main.src = gym.images[index].src; main.alt = gym.images[index].alt; caption.textContent = gym.images[index].caption;
    thumbs.querySelectorAll('button').forEach((item, i) => item.setAttribute('aria-current', String(i === index)));
  };
  const thumbs = h('div', { class: 'gallery-thumbs', role: 'group', 'aria-label': 'Photos' }, gym.images.map((image, i) => h('button', { type: 'button', 'aria-label': `Photo ${i + 1}: ${image.alt}`, 'aria-current': String(i === 0), onclick: () => show(i) },
    h('img', { src: image.src, alt: '', loading: 'lazy', width: 120, height: 80 }))));
  return h('figure', { class: 'gallery' }, h('div', { class: 'gallery-main' }, main,
    gym.images.length > 1 ? h('div', { class: 'gallery-nav' }, button('', () => show(index - 1), { variant: 'ghost', icon: 'chevron-left', label: 'Previous photo', size: 'small' }), button('', () => show(index + 1), { variant: 'ghost', icon: 'chevron', label: 'Next photo', size: 'small' })) : null),
  caption, thumbs);
}

function plansSection(gym: Gym, plans: MembershipPlan[], hidden: number) {
  const compareBox = h('div', { class: 'duration-compare' });
  let left = plans[0].id, right = plans[plans.length - 1].id;
  const select = (value: string, set: (id: string) => void, labelText: string) => h('label', { class: 'field' }, h('span', { class: 'label' }, labelText),
    h('select', { class: 'input select', onchange: (event: Event) => { set((event.target as HTMLSelectElement).value); drawCompare(); } }, plans.map(plan => h('option', { value: plan.id, selected: plan.id === value }, `${plan.name} (${plural(plan.months, 'month')})`))));
  const drawCompare = () => {
    const a = plans.find(plan => plan.id === left)!, b = plans.find(plan => plan.id === right)!;
    const rows: [string, (plan: MembershipPlan) => string][] = [
      ['Duration', plan => plural(plan.months, 'month')],
      ['Membership total', plan => money(plan.price, gym.currency)],
      ['Per month', plan => money(effectiveMonthly(plan), gym.currency)],
      ['Saving vs paying monthly', plan => { const saving = savingVsMonthly(gym, plan); return saving ? `${money(saving.amount, gym.currency)} (${saving.percent}%)` : '—'; }],
      ['Joining fee', plan => plan.joiningFee ? money(plan.joiningFee, gym.currency) : 'None'],
      ['Refundable deposit', plan => plan.deposit ? money(plan.deposit, gym.currency) : 'None'],
      ['Total due', plan => money(totalDue(plan).total, gym.currency)],
      ['Payment schedule', plan => paymentSchedule(plan, gym.currency)],
      ['Personal training', plan => plan.ptSessions ? plural(plan.ptSessions, 'session') : 'Not included'],
      ['Classes', plan => plan.classesIncluded ? 'Included' : 'Not included'],
      ['Renewal', plan => plan.renewal],
      ['Cancellation', plan => plan.cancellation],
      ['Offer', plan => plan.offer ? `${plan.offer.label} (until ${new Date(plan.offer.validUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })})` : 'None'],
    ];
    replace(compareBox, h('div', { class: 'table-wrap' }, h('table', { class: 'data-table compare-table' },
      h('caption', { class: 'sr-only' }, `Comparison of ${a.name} and ${b.name}`),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, ''), h('th', { scope: 'col' }, a.name), h('th', { scope: 'col' }, b.name))),
      h('tbody', null, rows.map(([labelText, value]) => h('tr', null, h('th', { scope: 'row' }, labelText), h('td', null, value(a)), h('td', null, value(b))))))));
  };
  drawCompare();

  return h('section', { class: 'stack plans-section', id: 'plans', 'aria-labelledby': 'plans-title', style: { '--stack': '24px' } },
    h('div', { class: 'stack', style: { '--stack': '8px' } }, h('h2', { class: 'headline', id: 'plans-title' }, 'Memberships'),
      h('p', { class: 'small muted' }, 'Prices as listed by the gym. Savings are calculated against this gym’s own one-month price. Nothing is charged through Icarus.'),
      hidden ? h('p', { class: 'small muted' }, `${plural(hidden, 'other plan')} for other age groups ${hidden === 1 ? 'is' : 'are'} hidden.`) : null),
    h('ul', { class: 'membership-grid', role: 'list' }, plans.map(plan => h('li', { class: 'membership-card' },
      h('div', { class: 'row membership-top' }, h('p', { class: 'title' }, plan.name), h('span', { class: 'tag' }, BILLING(plan))),
      planPrice(gym, plan),
      h('p', { class: 'small' }, paymentSchedule(plan, gym.currency)),
      h('ul', { class: 'mini-facts', role: 'list' }, plan.includes.map(item => h('li', null, item)), plan.ptSessions ? h('li', null, `${plural(plan.ptSessions, 'personal training session')}`) : null),
      plan.offer ? h('p', { class: 'offer small' }, h('strong', null, plan.offer.label), ` · valid until ${new Date(plan.offer.validUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}. ${plan.offer.terms}`) : null,
      h('details', { class: 'membership-terms' }, h('summary', null, 'Renewal, cancellation and fees'),
        h('dl', { class: 'review-list' }, h('div', null, h('dt', null, 'Renewal'), h('dd', null, plan.renewal)), h('div', null, h('dt', null, 'Cancellation'), h('dd', null, plan.cancellation)),
          h('div', null, h('dt', null, 'Joining fee'), h('dd', null, plan.joiningFee ? money(plan.joiningFee, gym.currency) : 'None')), h('div', null, h('dt', null, 'Deposit'), h('dd', null, plan.deposit ? `${money(plan.deposit, gym.currency)}, refundable` : 'None')))),
      h('div', { class: 'row membership-actions' },
        linkButton('Enquire', `#/enquire?kind=membership&gym=${gym.id}&plan=${plan.id}`, { variant: 'primary', size: 'small' }),
        compareToggle(gym.id, plan.id))))),
    plans.length > 1 ? h('section', { class: 'stack', 'aria-labelledby': 'dur-title' }, h('h3', { class: 'title', id: 'dur-title' }, 'Compare two durations'),
      h('div', { class: 'row compare-selects' }, select(left, id => { left = id; }, 'First plan'), select(right, id => { right = id; }, 'Second plan')), compareBox) : null);
}

export function compareToggle(gymId: string, planId: string) {
  const node = h('button', { type: 'button', class: 'btn ghost small', 'aria-pressed': String(store.inCompare({ gymId, planId })) }, icon('compare'), store.inCompare({ gymId, planId }) ? 'In comparison' : 'Compare');
  node.addEventListener('click', () => {
    if (!store.toggleCompare({ gymId, planId })) { toast('You can compare up to four plans. Remove one first.', { kind: 'error', action: { label: 'Open', run: () => { location.hash = '#/memberships'; } } }); return; }
    const on = store.inCompare({ gymId, planId });
    node.setAttribute('aria-pressed', String(on));
    node.replaceChildren(icon('compare'), on ? 'In comparison' : 'Compare');
    toast(on ? 'Added to your comparison.' : 'Removed from your comparison.', on ? { action: { label: 'View', run: () => { location.hash = '#/memberships'; } } } : {});
  });
  return node;
}
