import { loadConfig } from './core/api.js';
import { h, replace } from './core/dom.js';
import { cue } from './core/feedback.js';
import { Router, type View } from './core/router.js';
import { store } from './core/store.js';
import { mark } from './ui/brand.js';
import { toast } from './ui/components.js';
import { icon } from './ui/icons.js';
import { coachView } from './views/coach.js';
import { homeView, welcomeView } from './views/home.js';
import { gymsView, gymView } from './views/gyms.js';
import { membershipsView } from './views/memberships.js';
import { bookingView, coachingView, proView } from './views/coaching.js';
import { enquireView, requestView } from './views/request.js';
import { nutritionView } from './views/nutrition.js';
import { profileView } from './views/profile.js';
import { privacyView, supportView, termsView } from './views/info.js';
import { workoutsView } from './views/workouts.js';
import { audienceSwitch } from './ui/market-ui.js';
import { libraryView, exerciseView } from './views/library.js';
import { notFoundView } from './views/not-found.js';
import { onboardingView } from './views/onboarding.js';
import { planEditorView, plansView } from './views/plans.js';
import { progressView } from './views/progress.js';
import { settingsView } from './views/settings.js';
import { summaryView } from './views/summary.js';
import { todayView } from './views/today.js';
import { workoutView } from './views/workout.js';
import { formatClock } from '../shared/fitness/stats.js';
import { elapsedMs } from '../shared/fitness/session.js';

const NAV = [
  { href: '#/gyms', label: 'Discover Gyms', key: 'gyms' },
  { href: '#/coaching', label: 'Personal Training', key: 'coaching' },
  { href: '#/nutrition', label: 'Nutrition', key: 'nutrition' },
  { href: '#/workouts', label: 'Workouts', key: 'workouts' },
  { href: '#/memberships', label: 'Memberships & Offers', key: 'memberships' },
];
const TRAINING = new Set(['today', 'workouts', 'plans', 'coach', 'progress', 'library', 'settings']);
const TABS = [
  { href: '#/today', label: 'Today', icon: 'today', key: 'today' },
  { href: '#/plans', label: 'Plans', icon: 'plans', key: 'plans' },
  { href: '#/coach', label: 'Coach', icon: 'coach', key: 'coach' },
  { href: '#/progress', label: 'Progress', icon: 'chart', key: 'progress' },
  { href: '#/library', label: 'Library', icon: 'library', key: 'library' },
];

const shell = document.getElementById('shell')!;
const topbar = document.getElementById('topbar')!;
const tabbar = document.getElementById('tabbar')!;
let currentNav = '';
let immersive = false;

function resumePill() {
  if (!store.session || currentNav === 'workout') return null;
  return h('a', { class: 'resume-pill', href: '#/workout', 'aria-label': 'Resume your workout in progress' },
    h('span', { class: 'dot', 'aria-hidden': 'true' }), h('span', { class: 'resume-time tabular' }, store.session.pausedAt ? 'Paused' : formatClock(elapsedMs(store.session, Date.now()))), h('span', { class: 'resume-label' }, 'Resume'));
}

/** "Get Started" leads to the next unfinished step; once everything is set up it becomes "Today". */
function start(): { href: string; label: string } {
  if (!store.local.audience) return { href: '#/welcome', label: 'Get Started' };
  if (!store.profile) return { href: '#/onboarding', label: 'Get Started' };
  return { href: '#/today', label: 'Today' };
}

function openMenu(trigger: HTMLElement) {
  const close = () => { panel.close(); };
  const panel = h('dialog', { class: 'menu-panel surface-dark', 'aria-label': 'Menu' },
    h('div', { class: 'menu-head container' },
      h('a', { class: 'brand', href: '#/', onclick: close }, mark(), h('span', { class: 'wordmark' }, 'Icarus')),
      h('button', { type: 'button', class: 'btn ghost icon small', 'aria-label': 'Close menu', onclick: close }, icon('close'))),
    h('nav', { class: 'menu-links container', 'aria-label': 'Main' },
      h('ul', { role: 'list' }, [{ href: '#/', label: 'Home', key: 'home' }, ...NAV].map((item, index) => h('li', null,
        h('a', { href: item.href, onclick: close, 'aria-current': currentNav === item.key ? 'page' : null, style: { '--i': String(index) } }, h('span', { class: 'numeral' }, String(index + 1).padStart(2, '0')), item.label))))),
    h('div', { class: 'menu-foot container' },
      audienceSwitch(),
      h('a', { class: 'btn ghost', href: '#/profile', onclick: close }, icon('user'), 'Profile'),
      h('a', { class: 'btn primary', href: start().href, onclick: close }, start().label)));
  panel.addEventListener('close', () => { panel.remove(); trigger.focus(); });
  panel.addEventListener('click', event => { if ((event.target as HTMLElement).closest('.audience-switch')) close(); });
  document.body.append(panel);
  panel.showModal();
}

function renderChrome() {
  const training = TRAINING.has(currentNav) && Boolean(store.profile);
  const menuButton = h('button', { type: 'button', class: 'btn ghost icon small nav-menu', 'aria-label': 'Open menu', 'aria-haspopup': 'dialog', onclick: (event: Event) => openMenu(event.currentTarget as HTMLElement) }, icon('menu'));
  replace(topbar, h('div', { class: 'container' },
    h('a', { class: 'brand', href: '#/', 'aria-label': 'Icarus home' }, mark(), h('span', { class: 'wordmark' }, 'Icarus')),
    h('nav', { class: 'nav-links', 'aria-label': 'Primary' }, NAV.map(item => h('a', { class: 'nav-link', href: item.href, 'aria-current': currentNav === item.key || (item.key === 'workouts' && training) ? 'page' : null }, item.label))),
    h('div', { class: 'nav-actions' }, resumePill(),
      h('a', { class: 'nav-link nav-profile', href: '#/profile', 'aria-current': currentNav === 'profile' ? 'page' : null }, icon('user'), h('span', null, 'Profile')),
      currentNav === 'welcome' || currentNav === 'onboarding' ? null : h('a', { class: 'btn primary small nav-start', href: start().href }, start().label),
      menuButton)));
  tabbar.hidden = !training || immersive;
  replace(tabbar, TABS.map(item => h('a', { href: item.href, 'aria-current': currentNav === item.key ? 'page' : null }, icon(item.icon), item.label)));
}

const outlet = document.getElementById('app')!;
const router = new Router(outlet, (view: View) => {
  currentNav = view.nav ?? '';
  immersive = Boolean(view.immersive);
  document.body.className = `surface-${view.surface}`;
  shell.classList.toggle('immersive', immersive);
  renderChrome();
  shell.classList.toggle('has-tabbar', !tabbar.hidden);
}, notFoundView);

const needsProfile = (factory: Parameters<Router['add']>[1]): Parameters<Router['add']>[1] => context => store.profile ? factory(context) : '#/onboarding';
// First visit: ask who Icarus is for before showing tailored content.
const needsAudience = (factory: Parameters<Router['add']>[1]): Parameters<Router['add']>[1] => context => store.local.audience ? factory(context) : `#/welcome?next=${encodeURIComponent(location.hash || '#/')}`;

router
  .add('/', needsAudience(homeView))
  .add('/welcome', welcomeView)
  .add('/gyms', needsAudience(gymsView))
  .add('/gyms/:id', needsAudience(gymView))
  .add('/memberships', needsAudience(membershipsView))
  .add('/coaching', needsAudience(coachingView))
  .add('/coaching/:id', needsAudience(bookingView))
  .add('/pros/:id', needsAudience(proView))
  .add('/enquire', needsAudience(enquireView))
  .add('/requests/:ref', requestView)
  .add('/nutrition', needsAudience(nutritionView))
  .add('/workouts', needsAudience(workoutsView))
  .add('/profile', profileView)
  .add('/privacy', privacyView)
  .add('/terms', termsView)
  .add('/support', supportView)
  .add('/onboarding', needsAudience(onboardingView))
  .add('/today', needsProfile(todayView))
  .add('/workout', needsProfile(workoutView))
  .add('/summary/:id', needsProfile(summaryView))
  .add('/plans', needsProfile(plansView))
  .add('/plans/:id', needsProfile(planEditorView))
  .add('/coach', needsProfile(coachView))
  .add('/progress', needsProfile(progressView))
  .add('/library', libraryView)
  .add('/library/:id', exerciseView)
  .add('/settings', needsProfile(settingsView));

// Data changed in another tab: redraw what is on screen.
store.subscribe(reason => {
  if (reason === 'external' || reason === 'reset' || reason === 'import' || reason === 'audience') router.refresh();
  else renderChrome();
});

// Keep timers honest everywhere: a rest that ends while the user is on another screen still chimes.
function settleTimers() {
  const events = store.settleSession();
  if (!events.length) return;
  cue(events.includes('hold-done') ? 'hold-done' : 'rest-done');
  if (currentNav !== 'workout' && document.visibilityState === 'visible') toast(events.includes('hold-done') ? 'Hold complete. Set logged.' : 'Rest is over. Next set is ready.', { action: { label: 'Open', run: () => router.navigate('#/workout') } });
}
setInterval(() => {
  settleTimers();
  const time = topbar.querySelector('.resume-time');
  if (time && store.session) time.textContent = store.session.pausedAt ? 'Paused' : formatClock(elapsedMs(store.session, Date.now()));
}, 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') settleTimers(); });

async function boot() {
  store.applyAppearance();
  try { store.config = await loadConfig(); }
  catch { store.configError = 'Could not reach the Icarus server. Coaching is unavailable until it is running; everything else works offline.'; }
  if (!store.persistent) toast('This browser is blocking storage. Your data will be lost when you close the tab.', { kind: 'error', ms: 10000 });
  if (store.repo.report.dropped.length) toast(`Some saved data could not be read and was skipped (${store.repo.report.dropped.join(', ')}).`, { kind: 'error', ms: 10000 });
  renderChrome();
  router.render();
}

void boot();
