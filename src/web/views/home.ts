import { AUDIENCE_INFO, safetyNote } from '../../shared/audience.js';
import { EXERCISES, MUSCLE_LABEL, suitableFor } from '../../shared/fitness/exercises.js';
import { splitsFor } from '../../shared/fitness/programs.js';
import { AUDIENCES, type Audience } from '../../shared/fitness/types.js';
import { effectiveMonthly, money } from '../../shared/marketplace/pricing.js';
import { serializeGymQuery, EMPTY_QUERY } from '../../shared/marketplace/search.js';
import type { UserLocation } from '../../shared/marketplace/types.js';
import { h } from '../core/dom.js';
import { load, market } from '../core/market.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { mark } from '../ui/brand.js';
import { eyebrow, linkButton } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { audienceSwitch, demoBadge, gymCard, locationPicker, notice, sectionHead } from '../ui/market-ui.js';
import { cardPhoto } from '../ui/photo.js';

export function gymsHref(location: UserLocation | null, extra: Partial<typeof EMPTY_QUERY> = {}) {
  const params = serializeGymQuery({ ...EMPTY_QUERY, audience: store.audience(), near: location ? { lat: location.lat, lng: location.lng } : null, cityId: location?.cityId ?? null, ...extra });
  if (location) params.set('label', location.label);
  return `#/gyms?${params}`;
}

/** First visit: choose who Icarus should tailor itself to. */
export function welcomeView(context: ViewContext): View {
  let selected: Audience = store.local.audience ?? 'adults';
  const next = context.query.get('next') ?? '#/';
  const cards = AUDIENCES.map((id, index) => {
    const info = AUDIENCE_INFO[id];
    return h('label', { class: 'audience-card' },
      h('input', { type: 'radio', name: 'audience', value: id, checked: id === selected, onchange: () => { selected = id; } }),
      h('span', { class: 'audience-numeral numeral', 'aria-hidden': 'true' }, String(index + 1).padStart(2, '0')),
      h('span', { class: 'audience-label' }, info.label),
      h('span', { class: 'tag' }, info.ages),
      h('span', { class: 'audience-headline' }, info.headline),
      h('ul', { class: 'audience-focus', role: 'list' }, info.focus.map(item => h('li', null, item))));
  });
  const el = h('div', { class: 'page welcome surface-dark' }, h('div', { class: 'container narrow-wide' },
    h('div', { class: 'welcome-mark', 'aria-hidden': 'true' }, mark('')),
    eyebrow('Welcome to Icarus'),
    h('h1', { class: 'display' }, 'Who are you ', h('em', null, 'exploring for?')),
    h('p', { class: 'lead' }, 'Icarus tailors gyms, programmes, coaches and nutrition support to the person training. You can change this at any time from the menu.'),
    h('form', { class: 'stack', style: { '--stack': '28px' }, onsubmit: (event: Event) => { event.preventDefault(); store.setAudience(selected); context.navigate(next.startsWith('#/') ? next : '#/'); } },
      h('fieldset', { class: 'audience-grid' }, h('legend', { class: 'sr-only' }, 'Audience'), cards),
      h('p', { class: 'small muted' }, 'Choosing Kids means a parent or guardian manages enquiries and bookings, and adult weight-loss programmes are hidden.'),
      h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary' }, 'Continue', icon('arrow', 'arrow'))))));
  return { el, title: 'Welcome', surface: 'dark', nav: 'welcome' };
}

export function homeView(context: ViewContext): View {
  const audience = store.audience();
  const info = AUDIENCE_INFO[audience];

  const hero = h('section', { class: 'hero home-hero', 'aria-labelledby': 'hero-title' },
    h('div', { class: 'hero-media', 'aria-hidden': 'true' }, h('img', { src: '/web/media/exercises/Barbell_Deadlift-0.webp', alt: '', width: 850, height: 567, fetchpriority: 'high' })),
    h('div', { class: 'container hero-inner' },
      h('div', { class: 'hero-copy' },
        h('p', { class: 'eyebrow reveal', style: { '--i': '0' } }, 'Icarus · Discover · Train · Transform'),
        h('h1', { class: 'hero-title reveal', id: 'hero-title', style: { '--i': '1' } }, 'Your fitness.', h('br'), 'Your people.', h('br'), h('em', null, 'Your standard.')),
        h('p', { class: 'lead reveal', style: { '--i': '2' } }, 'Discover exceptional gyms, build your training routine, and bring personal coaching and nutrition together in one place.'),
        h('div', { class: 'row reveal', style: { '--i': '3' } },
          linkButton('Explore Gyms', gymsHref(store.local.location), { variant: 'primary', iconAfter: 'arrow' }),
          linkButton('Find My Coaching Team', '#/coaching', { variant: 'ghost' })),
        h('div', { class: 'hero-search reveal', style: { '--i': '4' } }, locationPicker({ onPick: location => context.navigate(gymsHref(location)), compact: true }))),
      h('p', { class: 'hero-credit tag' }, 'Photo: Free Exercise DB, public domain')));

  const audienceSection = h('section', { class: 'surface-light home-audience', 'aria-labelledby': 'aud-title' }, h('div', { class: 'container section' },
    sectionHead({ eyebrow: '01 · For whom', title: ['Tailored to ', h('em', null, 'who is training.')], id: 'aud-title', lead: 'Recommendations, programmes and providers change with the audience you choose.', action: audienceSwitch() }),
    h('div', { class: 'audience-strip' }, AUDIENCES.map(id => {
      const item = AUDIENCE_INFO[id];
      return h('button', { type: 'button', class: `audience-tile${id === audience ? ' current' : ''}`, 'aria-pressed': String(id === audience), onclick: () => { store.setAudience(id); context.navigate('#/', true); } },
        h('span', { class: 'tag' }, item.ages), h('span', { class: 'title' }, item.label), h('span', { class: 'small' }, item.headline),
        h('span', { class: 'tag audience-state' }, id === audience ? 'Selected' : 'Choose'));
    })),
    notice(safetyNote(audience), 'safety')));

  const featured = h('div', { class: 'gym-grid', 'aria-live': 'polite' });
  const location = store.local.location;
  const params = serializeGymQuery({ ...EMPTY_QUERY, audience, near: location ? { lat: location.lat, lng: location.lng } : null, cityId: location?.cityId ?? null, sort: location ? 'distance' : 'name' });
  void load(featured, () => market.gyms(params), data => data.results.length
    ? data.results.slice(0, 3).map(result => gymCard(result.gym, result))
    : [h('p', { class: 'muted' }, 'No gyms suit this audience in your area yet.')]);

  const locationSection = h('section', { class: 'home-location surface-dark', 'aria-labelledby': 'loc-title' }, h('div', { class: 'container section split' },
    h('div', { class: 'stack' }, eyebrow('02 · Near you'), h('h2', { class: 'headline', id: 'loc-title' }, 'Start with ', h('em', null, 'where you are.')),
      h('p', { class: 'body' }, 'Search by city, area or postcode, or share your location if you choose. It is rounded to about 1 km and never stored on our server.')),
    h('div', { class: 'stack' }, locationPicker({ onPick: place => context.navigate(gymsHref(place)) }),
      h('p', { class: 'small muted' }, 'Covered in this demonstration: Bengaluru, Mumbai, New Delhi and Hyderabad.'))));

  const featuredSection = h('section', { class: 'surface-light', 'aria-labelledby': 'feat-title' }, h('div', { class: 'container section' },
    sectionHead({ eyebrow: '03 · Gyms', title: location ? ['Gyms near ', h('em', null, location.label.split(',')[0])] : ['Gyms for ', h('em', null, info.label.toLowerCase())], id: 'feat-title',
      lead: 'Example listings that show how gyms appear on Icarus. They are fictional; a live deployment connects a verified gym directory.', action: linkButton('All gyms', gymsHref(location), { variant: 'ghost', iconAfter: 'arrow' }) }),
    featured));

  // Membership comparison preview: one gym's own prices across durations.
  const compare = h('div', { class: 'compare-preview' });
  void load(compare, async () => (await market.gyms(params)).results.find(result => result.gym.memberships.filter(plan => plan.audiences.includes(audience)).length >= 3), result => {
    if (!result) return h('p', { class: 'muted' }, 'No membership comparison is available for this audience yet.');
    const gym = result.gym;
    const plans = gym.memberships.filter(plan => plan.audiences.includes(audience)).sort((a, b) => a.months - b.months);
    return h('div', { class: 'stack' },
      h('div', { class: 'row compare-preview-head' }, h('p', { class: 'title' }, gym.name), gym.demo ? demoBadge() : null),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
        h('caption', { class: 'sr-only' }, `${gym.name} membership prices by duration`),
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Duration'), h('th', { scope: 'col' }, 'Total'), h('th', { scope: 'col' }, 'Per month'), h('th', { scope: 'col' }, 'Billing'))),
        h('tbody', null, plans.map(plan => h('tr', null, h('th', { scope: 'row' }, `${plan.months} month${plan.months === 1 ? '' : 's'}`), h('td', { class: 'numeral-cell' }, money(plan.price, gym.currency)),
          h('td', { class: 'numeral-cell' }, money(effectiveMonthly(plan), gym.currency)), h('td', null, plan.billing === 'upfront' ? 'Paid upfront' : 'Monthly')))))),
      h('div', { class: 'row' }, linkButton('Compare plans at this gym', `#/gyms/${gym.id}?section=plans`, { variant: 'ghost', size: 'small' }), linkButton('Compare across gyms', '#/memberships', { variant: 'ghost', size: 'small' })));
  });
  const membershipSection = h('section', { class: 'surface-light home-memberships', 'aria-labelledby': 'mem-title' }, h('div', { class: 'container section split' },
    h('div', { class: 'stack' }, eyebrow('04 · Memberships'), h('h2', { class: 'headline', id: 'mem-title' }, 'See the real price ', h('em', null, 'of every term.')),
      h('p', { class: 'body' }, 'Every plan shows its total, the effective monthly price, fees, deposit, renewal and cancellation terms. Savings are shown only when they follow from the gym’s own prices.')),
    compare));

  const packages = h('div', { class: 'package-grid' });
  void load(packages, () => market.info(), data => {
    const list = data.packages.filter(item => item.audiences.includes(audience));
    return list.length ? list.slice(0, 4).map(item => h('a', { class: 'package-tile', href: `#/coaching/${item.id}` },
      h('p', { class: 'tag' }, `${item.weeks} weeks`), h('p', { class: 'title' }, item.name), h('p', { class: 'small muted' }, item.summary),
      h('ul', { class: 'mini-facts', role: 'list' },
        item.trainingSessions ? h('li', null, `${item.trainingSessions} training sessions`) : null,
        item.nutritionConsults ? h('li', null, `${item.nutritionConsults} nutrition consultations`) : null,
        item.mealPlanning ? h('li', null, 'Meal planning') : null),
      h('span', { class: 'text-link small' }, 'Build this team', icon('arrow', 'arrow')))) : [h('p', { class: 'muted' }, 'No coaching packages for this audience yet.')];
  });
  const packageSection = h('section', { class: 'home-packages surface-dark', 'aria-labelledby': 'pkg-title' }, h('div', { class: 'container section' },
    sectionHead({ eyebrow: '05 · Transform', title: audience === 'kids' ? ['Supervised coaching for ', h('em', null, 'young athletes.')] : ['A trainer and a nutritionist, ', h('em', null, 'one plan.')], id: 'pkg-title',
      lead: audience === 'kids' ? 'Checked youth coaches, with a parent or guardian making every request. Prices are built from each coach’s listed rate.' : 'Choose a package, pick your trainer and nutritionist, and send one booking request. Prices are built from each professional’s listed rate.', action: linkButton('All packages', '#/coaching', { variant: 'ghost', iconAfter: 'arrow' }) }),
    packages));

  const programs = splitsFor(audience);
  const programSection = h('section', { class: 'surface-light', 'aria-labelledby': 'prog-title' }, h('div', { class: 'container section' },
    sectionHead({ eyebrow: '06 · Train', title: ['Programmes for ', h('em', null, info.label.toLowerCase())], id: 'prog-title', lead: 'Structured weekly plans you can follow in the app, with every set logged and every rest timed.',
      action: linkButton('Start training', store.profile ? '#/today' : '#/onboarding', { variant: 'ghost', iconAfter: 'arrow' }) }),
    h('ol', { class: 'program-list', role: 'list' }, programs.map((split, index) => h('li', null,
      h('span', { class: 'numeral' }, String(index + 1).padStart(2, '0')),
      h('div', { class: 'stack', style: { '--stack': '4px' } }, h('p', { class: 'title' }, split.name), h('p', { class: 'small muted' }, split.summary)),
      h('span', { class: 'tag' }, `${split.days} days a week`))))));

  const preview = EXERCISES.filter(item => suitableFor(item, audience)).filter((_, index, list) => index % Math.max(1, Math.floor(list.length / 4)) === 0).slice(0, 4);
  const librarySection = h('section', { class: 'surface-light home-library', 'aria-labelledby': 'lib-title' }, h('div', { class: 'container section' },
    sectionHead({ eyebrow: '07 · Exercise library', title: ['Every movement, ', h('em', null, 'demonstrated.')], id: 'lib-title', lead: `${EXERCISES.length} exercises with real photographs of the start and finish positions, step-by-step instructions, mistakes to avoid and easier or harder versions.`,
      action: linkButton('Open the library', '#/library', { variant: 'ghost', iconAfter: 'arrow' }) }),
    h('ul', { class: 'exercise-grid', role: 'list' }, preview.map(item => h('li', null, h('a', { class: 'exercise-card', href: `#/library/${item.id}` }, cardPhoto(item.id),
      h('span', { class: 'exercise-card-body' }, h('span', { class: 'title' }, item.name), h('span', { class: 'tag' }, item.primary.map(muscle => MUSCLE_LABEL[muscle]).join(' · ')))))))));

  const steps: [string, string][] = [
    ['Choose who is training', 'Kids, adults or older adults. Every list adapts, and you can switch any time.'],
    ['Discover and compare', 'Filter gyms by distance, budget, facilities and hours. Compare membership terms side by side.'],
    ['Send a request', 'Enquire about a membership or request a coaching package. You get a reference straight away.'],
    ['The provider confirms', 'Only the gym or professional can confirm a place, a time and the final price. Nothing is charged here.'],
  ];
  const howSection = h('section', { class: 'surface-dark', 'aria-labelledby': 'how-title' }, h('div', { class: 'container section' },
    sectionHead({ eyebrow: '08 · How it works', title: ['Four steps, ', h('em', null, 'no surprises.')], id: 'how-title' }),
    h('ol', { class: 'steps', role: 'list' }, steps.map(([title, text], index) => h('li', null, h('span', { class: 'numeral' }, String(index + 1).padStart(2, '0')), h('p', { class: 'title' }, title), h('p', { class: 'small' }, text))))));

  const trustSection = h('section', { class: 'surface-light home-trust', 'aria-labelledby': 'trust-title' }, h('div', { class: 'container section split' },
    h('div', { class: 'stack' }, eyebrow('09 · Trust'), h('h2', { class: 'headline', id: 'trust-title' }, 'What we show, ', h('em', null, 'and why you can rely on it.'))),
    h('ul', { class: 'trust-list', role: 'list' },
      h('li', null, icon('shield'), h('div', null, h('p', { class: 'title' }, 'Verification is shown, never assumed'), h('p', { class: 'small' }, 'Each qualification says whether it has been checked. In this demonstration none have, and the profiles say so.'))),
      h('li', null, icon('check'), h('div', null, h('p', { class: 'title' }, 'Reviews only from verified sources'), h('p', { class: 'small' }, 'No ratings are displayed until a verified review source is connected. We never write or seed reviews.'))),
      h('li', null, icon('info'), h('div', null, h('p', { class: 'title' }, 'Requests, not fake bookings'), h('p', { class: 'small' }, 'A request is marked received until the provider confirms it. Icarus does not take payments.'))),
      h('li', null, icon('user'), h('div', null, h('p', { class: 'title' }, 'Children are protected'), h('p', { class: 'small' }, 'A parent or guardian makes every request for a child. We never ask for a child’s name, and no child profile is ever shown.')))),
  ));

  const finalSection = h('section', { class: 'landing-final' }, h('div', { class: 'container section final-inner' },
    h('div', { class: 'final-mark', 'aria-hidden': 'true' }, mark('')),
    h('h2', { class: 'display' }, 'Set your ', h('em', null, 'standard.')),
    h('p', { class: 'lead' }, 'Find a gym, build your team, or start a programme today.'),
    h('div', { class: 'row center' }, linkButton('Explore Gyms', gymsHref(location), { variant: 'primary', iconAfter: 'arrow' }), linkButton('Find My Coaching Team', '#/coaching', { variant: 'ghost' }))));

  const el = h('div', { class: 'landing home' }, hero, audienceSection, locationSection, featuredSection, membershipSection, packageSection, programSection, librarySection, howSection, trustSection, finalSection, footer());
  return { el, title: 'Your fitness. Your people. Your standard.', surface: 'dark', nav: 'home' };
}

export function footer() {
  const support = store.config?.supportEmail;
  const column = (title: string, links: [string, string][]) => h('nav', { class: 'footer-col', 'aria-label': title }, h('p', { class: 'eyebrow' }, title), h('ul', { role: 'list' }, links.map(([label, href]) => h('li', null, h('a', { href }, label)))));
  return h('footer', { class: 'site-footer surface-dark' }, h('div', { class: 'container' },
    h('div', { class: 'footer-grid' },
      h('div', { class: 'stack footer-brand' }, h('a', { class: 'brand', href: '#/', 'aria-label': 'Icarus home' }, mark(), h('span', { class: 'wordmark' }, 'Icarus')),
        h('p', { class: 'small muted' }, 'Gyms, training, coaching and nutrition in one place.'),
        store.config?.marketplace.demo !== false ? h('p', { class: 'small muted' }, 'This deployment uses demonstration listings. Gyms and professionals shown are fictional.') : null),
      column('Discover', [['Gyms', '#/gyms'], ['Memberships & offers', '#/memberships'], ['Personal training', '#/coaching'], ['Nutrition', '#/nutrition']]),
      column('Train', [['Workouts', '#/workouts'], ['Exercise library', '#/library'], ['Coach', '#/coach'], ['Progress', '#/progress']]),
      column('Icarus', [['Your profile', '#/profile'], ['Support', '#/support'], ['Privacy', '#/privacy'], ['Terms', '#/terms']])),
    h('div', { class: 'footer-base' },
      h('p', { class: 'small muted' }, 'General fitness and nutrition information, not medical advice. Stop and seek help if you feel pain, dizziness or chest discomfort.'),
      h('p', { class: 'small muted' }, 'Contact: ', support ? h('a', { href: `mailto:${support}` }, support) : h('a', { href: '#/support' }, 'support form')))));
}
