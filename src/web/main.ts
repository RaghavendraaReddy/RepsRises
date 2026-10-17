import { loadConfig } from './core/api.js';
import { h, replace } from './core/dom.js';
import { cue } from './core/feedback.js';
import { Router, type View } from './core/router.js';
import { store } from './core/store.js';
import { mark } from './ui/brand.js';
import { toast } from './ui/components.js';
import { icon } from './ui/icons.js';
import { coachView } from './views/coach.js';
import { landingView } from './views/landing.js';
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
  { href: '#/today', label: 'Today', icon: 'today', key: 'today' },
  { href: '#/plans', label: 'Plans', icon: 'plans', key: 'plans' },
  { href: '#/coach', label: 'Coach', icon: 'coach', key: 'coach' },
  { href: '#/progress', label: 'Progress', icon: 'chart', key: 'progress' },
  { href: '#/library', label: 'Library', icon: 'library', key: 'library' },
];
const TABS = [...NAV.slice(0, 4), { href: '#/settings', label: 'Settings', icon: 'settings', key: 'settings' }];

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

function renderChrome() {
  const onboarded = Boolean(store.profile);
  replace(topbar, h('div', { class: 'container' },
    h('a', { class: 'brand', href: onboarded ? '#/today' : '#/welcome', 'aria-label': 'Icarus home' }, mark(), h('span', { class: 'wordmark' }, 'Icarus')),
    onboarded ? h('nav', { class: 'nav-links', 'aria-label': 'Primary' }, NAV.map(item => h('a', { class: 'nav-link', href: item.href, 'aria-current': currentNav === item.key ? 'page' : null }, item.label))) : null,
    h('div', { class: 'nav-actions' }, resumePill(),
      onboarded ? h('a', { class: 'btn ghost icon small nav-settings', href: '#/settings', 'aria-label': 'Settings', 'aria-current': currentNav === 'settings' ? 'page' : null }, icon('settings'))
        : h('a', { class: 'nav-link', href: '#/onboarding' }, 'Get started'))));
  tabbar.hidden = !onboarded || immersive;
  replace(tabbar, TABS.map(item => h('a', { href: item.href, 'aria-current': currentNav === item.key ? 'page' : null }, icon(item.icon), item.label)));
}

const outlet = document.getElementById('app')!;
const router = new Router(outlet, (view: View) => {
  currentNav = view.nav ?? '';
  immersive = Boolean(view.immersive);
  document.body.className = `surface-${view.surface}`;
  shell.classList.toggle('immersive', immersive);
  renderChrome();
}, notFoundView);

const needsProfile = (factory: Parameters<Router['add']>[1]): Parameters<Router['add']>[1] => context => store.profile ? factory(context) : '#/welcome';

router
  .add('/', () => store.profile ? '#/today' : '#/welcome')
  .add('/welcome', landingView)
  .add('/onboarding', onboardingView)
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
  if (reason === 'external' || reason === 'reset' || reason === 'import') router.refresh();
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
