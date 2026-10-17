import { AUDIENCE_INFO } from '../../shared/audience.js';
import { AUDIENCES, type Audience } from '../../shared/fitness/types.js';
import type { SavedKind } from '../../shared/marketplace/local.js';
import { formatDistance, nearestCity } from '../../shared/marketplace/geo.js';
import { effectiveMonthly, money, savingVsMonthly } from '../../shared/marketplace/pricing.js';
import { CATEGORY_LABEL, type Gym, type MembershipPlan, type Professional, type Qualification, type UserLocation } from '../../shared/marketplace/types.js';
import { debounce, h, nextId, type Child } from '../core/dom.js';
import { market, type GymCard } from '../core/market.js';
import { store } from '../core/store.js';
import { button, eyebrow, openDialog, toast } from './components.js';
import { icon } from './icons.js';

// Building blocks shared by the discovery, coaching and nutrition screens.

export function sectionHead(options: { eyebrow: string; title: Child; lead?: string; action?: Child; id?: string }) {
  return h('header', { class: 'section-head' },
    h('div', { class: 'stack', style: { '--stack': '12px' } }, eyebrow(options.eyebrow), h('h2', { class: 'headline', id: options.id }, options.title), options.lead ? h('p', { class: 'body muted section-lead' }, options.lead) : null),
    options.action ?? null);
}

export function notice(text: Child, kind: 'info' | 'warn' | 'safety' = 'info') {
  return h('div', { class: `notice ${kind}`, role: kind === 'warn' ? 'note' : null }, icon(kind === 'safety' ? 'shield' : kind === 'warn' ? 'alert' : 'info'), h('div', { class: 'notice-text' }, text));
}

/** Every demonstration record says so where it is shown. */
export function demoBadge(text = 'Demo listing') {
  return h('span', { class: 'badge demo', title: 'Fictional example data for demonstration. Not a real business.' }, text);
}

export function qualification(item: Qualification) {
  return h('li', { class: 'qualification' }, h('span', null, item.name),
    h('span', { class: `badge ${item.verified ? 'verified' : 'unverified'}` }, item.verified ? 'Verified' : 'Not verified'),
    h('span', { class: 'small muted' }, item.issuer));
}

export function saveButton(kind: SavedKind, id: string, label: string, options: { compact?: boolean } = {}) {
  const make = () => {
    const saved = store.isSaved(kind, id);
    return [icon(saved ? 'heart-filled' : 'heart'), options.compact ? null : h('span', null, saved ? 'Saved' : 'Save')];
  };
  const node = h('button', { type: 'button', class: `btn ghost small save-btn${options.compact ? ' icon' : ''}`, 'aria-pressed': String(store.isSaved(kind, id)), 'aria-label': options.compact ? `Save ${label}` : null }, make());
  node.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation();
    try {
      const saved = store.toggleSaved(kind, id);
      node.setAttribute('aria-pressed', String(saved));
      node.replaceChildren(...make().filter((item): item is SVGSVGElement | HTMLSpanElement => item !== null));
      toast(saved ? `${label} saved to your profile.` : `${label} removed from saved.`);
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not save.', { kind: 'error' }); }
  });
  return node;
}

export function audienceTag(audiences: Audience[]) {
  return h('span', { class: 'tag' }, audiences.map(item => AUDIENCE_INFO[item].label).join(' · '));
}

/** Gym result card. The image is representative and captioned as such on the detail page. */
export function gymCard(gym: GymCard, extra: { distanceKm?: number | null; from?: { plan: MembershipPlan; monthly: number } | null } = {}) {
  const image = gym.images[0];
  const titleId = nextId('gym');
  return h('article', { class: 'gym-card', 'aria-labelledby': titleId },
    h('a', { class: 'gym-card-media', href: `#/gyms/${gym.id}`, tabindex: '-1', 'aria-hidden': 'true' }, image ? h('img', { src: image.src, alt: '', loading: 'lazy', decoding: 'async', width: 450, height: 300 }) : null,
      gym.demo ? demoBadge() : null),
    h('div', { class: 'gym-card-body' },
      h('div', { class: 'row gym-card-top' },
        h('p', { class: 'tag' }, gym.area, extra.distanceKm !== undefined && extra.distanceKm !== null ? ` · ${formatDistance(extra.distanceKm)}` : ''),
        saveButton('gyms', gym.id, gym.name, { compact: true })),
      h('h3', { class: 'title', id: titleId }, h('a', { href: `#/gyms/${gym.id}` }, gym.name)),
      h('p', { class: 'small muted' }, gym.tagline),
      h('p', { class: 'tag' }, gym.categories.map(item => CATEGORY_LABEL[item]).join(' · ')),
      h('div', { class: 'gym-card-foot' },
        extra.from ? h('p', { class: 'price' }, h('span', { class: 'small muted' }, 'From '), h('strong', { class: 'numeral' }, money(extra.from.monthly, gym.currency)), h('span', { class: 'small muted' }, ` /month on the ${extra.from.plan.name.toLowerCase()} plan`))
          : h('p', { class: 'small muted' }, 'No plan matches your filters'),
        h('p', { class: 'small muted' }, gym.reviews ? `${gym.reviews.rating.toFixed(1)} from ${gym.reviews.count} verified reviews (${gym.reviews.source})` : 'No verified reviews yet'))));
}

/** Price facts for a plan: total, effective monthly, and a saving only when it can be computed from the gym's own prices. */
export function planPrice(gym: Pick<Gym, 'currency' | 'memberships'>, plan: MembershipPlan) {
  const saving = savingVsMonthly(gym as Gym, plan);
  return h('div', { class: 'membership-price' },
    h('p', null, h('strong', { class: 'numeral' }, money(plan.price, gym.currency)), h('span', { class: 'small muted' }, ` total for ${plan.months} month${plan.months === 1 ? '' : 's'}`)),
    h('p', { class: 'small' }, `${money(effectiveMonthly(plan), gym.currency)} per month`),
    saving ? h('p', { class: 'small saving' }, `${money(saving.amount, gym.currency)} less than ${plan.months} × the 1-month price (${saving.percent}%)`) : null);
}

export function proCard(pro: Professional, options: { select?: { selected: boolean; onSelect: () => void; name: string } } = {}) {
  const verified = pro.qualifications.filter(item => item.verified).length;
  const body = [
    h('div', { class: 'pro-head' },
      h('span', { class: 'monogram', 'aria-hidden': 'true' }, pro.initials),
      h('div', { class: 'stack', style: { '--stack': '4px' } },
        h('p', { class: 'title' }, pro.name),
        h('p', { class: 'tag' }, pro.role === 'trainer' ? 'Personal trainer' : 'Nutritionist', ` · ${pro.experienceYears} years`)),
      pro.demo ? demoBadge('Demo profile') : null),
    h('p', { class: 'small' }, pro.specialties.slice(0, 3).join(' · ')),
    h('p', { class: 'small muted' }, `${pro.qualifications.length} qualification${pro.qualifications.length === 1 ? '' : 's'} listed · ${verified ? `${verified} verified` : 'none verified yet'}`),
    h('p', { class: 'small' }, h('strong', null, money(pro.rate, pro.currency)), pro.role === 'trainer' ? ' per session' : ' per consultation', ` · ${pro.formats.map(item => item.replace('-', ' ')).join(', ')}`),
  ];
  if (options.select) {
    return h('label', { class: `pro-card selectable${options.select.selected ? ' selected' : ''}` },
      h('input', { type: 'radio', name: options.select.name, checked: options.select.selected, onchange: options.select.onSelect, class: 'sr-only' }), body,
      h('a', { class: 'text-link small', href: `#/pros/${pro.id}`, target: '_self' }, 'View full profile'));
  }
  return h('article', { class: 'pro-card' }, body, h('div', { class: 'row' }, h('a', { class: 'btn ghost small', href: `#/pros/${pro.id}` }, 'View profile'), saveButton('professionals', pro.id, pro.name, { compact: true })));
}

/** Consent-first location: nothing is requested until the person presses the button. */
export function locationPicker(options: { onPick: (location: UserLocation) => void; compact?: boolean }) {
  const inputId = nextId('place');
  const results = h('ul', { class: 'place-results', role: 'list', 'aria-live': 'polite' });
  const status = h('p', { class: 'small muted', role: 'status' });
  const pick = (location: UserLocation) => {
    try { store.setLocation(location); } catch { /* still usable for this page */ }
    results.replaceChildren();
    options.onPick(location);
  };
  const lookup = debounce(async (query: string) => {
    if (query.trim().length < 2) { results.replaceChildren(); status.textContent = ''; return; }
    try {
      const data = await market.geocode(query);
      status.textContent = data.results.length ? '' : 'No match in the areas Icarus covers yet. Try a city (Bengaluru, Mumbai, New Delhi, Hyderabad), an area or a postcode.';
      results.replaceChildren(...data.results.map(place => h('li', null, h('button', { type: 'button', class: 'place-option', onclick: () => pick(place) }, icon('pin'), place.label))));
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Search failed.'; }
  }, 220);
  const input = h('input', { id: inputId, class: 'input', type: 'search', placeholder: 'City, area or postcode', autocomplete: 'off', oninput: (event: Event) => lookup((event.target as HTMLInputElement).value),
    onkeydown: (event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); (results.querySelector('button') as HTMLButtonElement | null)?.click(); } } });

  const useDevice = () => {
    if (!('geolocation' in navigator)) { status.textContent = 'This browser cannot share a location. Type a place instead.'; return; }
    openDialog({
      title: 'Use your current location?', eyebrow: 'Location', surface: 'light',
      body: h('div', { class: 'stack' },
        h('p', { class: 'body' }, 'Your browser will ask for permission. Icarus uses your position only to sort gyms by distance.'),
        h('ul', { class: 'feature-list small', role: 'list' },
          h('li', null, icon('check'), 'Rounded to about 1 km before it is used or saved.'),
          h('li', null, icon('check'), 'Kept on this device. Search requests send only the rounded position.'),
          h('li', null, icon('check'), 'Clear it any time from your profile.'))),
      footer: close => [button('Not now', close, { variant: 'ghost' }), button('Continue', () => {
        close();
        status.textContent = 'Waiting for your browser…';
        navigator.geolocation.getCurrentPosition(async position => {
          const point = { lat: Math.round(position.coords.latitude * 100) / 100, lng: Math.round(position.coords.longitude * 100) / 100 };
          let cityId: string | null = null, label = 'Near your location';
          try {
            const info = await market.info();
            const city = nearestCity(point, info.cities);
            cityId = city?.id ?? null;
            if (city) label = `Near you, ${city.name}`;
          } catch { /* distance sorting still works */ }
          status.textContent = cityId ? '' : 'You are outside the cities Icarus covers so far. Results are sorted by distance, but may be far away.';
          pick({ ...point, label, cityId, source: 'device' });
        }, error => {
          status.textContent = error.code === error.PERMISSION_DENIED ? 'Location permission was declined. Type a city, area or postcode instead.' : 'Your location could not be found. Type a place instead.';
        }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 });
      }, { variant: 'primary' })],
    });
  };

  return h('div', { class: `location-picker${options.compact ? ' compact' : ''}` },
    h('label', { class: 'label', for: inputId }, 'Where do you want to train?'),
    h('div', { class: 'location-row' },
      h('div', { class: 'search-field' }, icon('search'), input),
      button('Use my location', useDevice, { variant: 'ghost', icon: 'locate' })),
    results, status);
}

/** Lets the visitor switch audience from anywhere; screens re-render through the store. */
export function audienceSwitch() {
  const current = store.audience();
  return h('button', { type: 'button', class: 'audience-switch', 'aria-label': `Audience: ${AUDIENCE_INFO[current].label}. Change`, onclick: () => chooseAudience() },
    h('span', { class: 'tag' }, 'For'), h('span', null, AUDIENCE_INFO[current].label), icon('down-small'));
}

export function chooseAudience(after?: (audience: Audience) => void) {
  const current = store.audience();
  openDialog({
    title: 'Who are you exploring for?', eyebrow: 'Audience', surface: 'light',
    body: h('div', { class: 'audience-options', role: 'radiogroup', 'aria-label': 'Audience' }, AUDIENCES.map(id => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(id === current), class: 'audience-option',
      onclick: () => { store.setAudience(id); document.querySelector<HTMLDialogElement>('dialog[open]')?.close(); after?.(id); toast(`Showing recommendations for ${AUDIENCE_INFO[id].label.toLowerCase()}.`); },
    }, h('span', { class: 'title' }, AUDIENCE_INFO[id].label), h('span', { class: 'tag' }, AUDIENCE_INFO[id].ages), h('span', { class: 'small muted' }, AUDIENCE_INFO[id].summary)))),
  });
}

/** Labelled form control with an error slot wired for screen readers. */
export function field(options: { label: string; control: HTMLElement; hint?: string; error?: string; name: string; optional?: boolean }) {
  const id = options.control.id || nextId('f');
  options.control.id = id;
  const hintId = options.hint ? `${id}-hint` : '';
  const errorId = `${id}-error`;
  options.control.setAttribute('aria-describedby', [hintId, options.error ? errorId : ''].filter(Boolean).join(' ') || '');
  if (options.error) options.control.setAttribute('aria-invalid', 'true'); else options.control.removeAttribute('aria-invalid');
  return h('div', { class: `field${options.error ? ' has-error' : ''}`, dataset: { field: options.name } },
    h('label', { for: id }, options.label, options.optional ? h('span', { class: 'muted small' }, ' (optional)') : null),
    options.hint ? h('p', { class: 'hint', id: hintId }, options.hint) : null,
    options.control,
    options.error ? h('p', { class: 'field-error', id: errorId }, options.error) : null);
}
