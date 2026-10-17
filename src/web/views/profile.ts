import { AUDIENCE_INFO } from '../../shared/audience.js';
import { exerciseById } from '../../shared/fitness/exercises.js';
import { h } from '../core/dom.js';
import { load, market } from '../core/market.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { button, confirmDialog, eyebrow, linkButton, toast } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { chooseAudience, notice, sectionHead } from '../ui/market-ui.js';
import { thumb } from '../ui/photo.js';
import { STATUS_TEXT } from './request.js';

/**
 * There are no accounts: this profile is what this browser holds. It says so plainly instead of
 * imitating a sign-in.
 */
export function profileView(context: ViewContext): View {
  const audience = store.local.audience;
  const location = store.local.location;
  const saved = store.local.saved;

  const savedBox = h('div', { class: 'stack', style: { '--stack': '24px' } });
  const total = saved.gyms.length + saved.professionals.length + saved.packages.length + saved.exercises.length;
  if (!total) savedBox.append(h('p', { class: 'small muted' }, 'Nothing saved yet. Use the heart on gyms, professionals, packages and exercises.'));
  else void load(savedBox, async () => {
    const [info, gyms, pros] = await Promise.all([
      market.info(),
      Promise.all(saved.gyms.map(id => market.gym(id).then(data => data.gym).catch(() => null))),
      Promise.all(saved.professionals.map(id => market.professional(id).then(data => data.professional).catch(() => null))),
    ]);
    return { packages: info.packages.filter(item => saved.packages.includes(item.id)), gyms: gyms.filter(Boolean), pros: pros.filter(Boolean) };
  }, ({ packages, gyms, pros }) => {
    const group = (title: string, rows: Node[]) => rows.length ? h('section', { class: 'stack', style: { '--stack': '8px' } }, h('h3', { class: 'eyebrow' }, title), h('ul', { class: 'list', role: 'list' }, rows)) : null;
    const row = (href: string, title: string, meta: string, lead: Node | null = null) => h('li', null, h('a', { class: 'list-row', href }, lead, h('span', { class: 'stack', style: { '--stack': '2px' } }, h('span', { class: 'list-title' }, title), h('span', { class: 'list-meta' }, meta)), icon('chevron')));
    return [
      group('Gyms', gyms.map(gym => row(`#/gyms/${gym!.id}`, gym!.name, `${gym!.area}${gym!.demo ? ' · Demo listing' : ''}`))),
      group('Trainers and nutritionists', pros.map(pro => row(`#/pros/${pro!.id}`, pro!.name, `${pro!.role === 'trainer' ? 'Personal trainer' : 'Nutritionist'}${pro!.demo ? ' · Demo profile' : ''}`))),
      group('Packages', packages.map(pack => row(`#/coaching/${pack.id}`, pack.name, `${pack.weeks} weeks`))),
      group('Exercises', saved.exercises.map(id => exerciseById(id)).filter(Boolean).map(exercise => row(`#/library/${exercise!.id}`, exercise!.name, exercise!.summary.slice(0, 80), thumb(exercise!.id)))),
    ].filter((node): node is HTMLElement => Boolean(node));
  });

  const requests = store.local.requests;
  const requestsBox = requests.length ? h('ul', { class: 'list', role: 'list' }, requests.map(item => h('li', null, h('a', { class: 'list-row', href: `#/requests/${item.ref}` },
    h('span', { class: 'stack', style: { '--stack': '2px' } }, h('span', { class: 'list-title' }, item.summary), h('span', { class: 'list-meta' }, `${item.ref} · ${new Date(item.createdAt).toLocaleDateString()}`)),
    h('span', { class: `badge status-${item.status}` }, STATUS_TEXT[item.status].label), icon('chevron')))))
    : h('p', { class: 'small muted' }, 'No requests from this device yet.');

  const el = h('div', { class: 'page surface-light profile' }, h('div', { class: 'container stack', style: { '--stack': '48px' } },
    h('header', { class: 'page-head' }, eyebrow('Profile'), h('h1', { class: 'display' }, 'Your ', h('em', null, 'profile.')),
      h('p', { class: 'lead' }, store.profile?.name ? `Welcome back, ${store.profile.name}.` : 'Everything Icarus knows about you, in one place.')),
    notice(['Icarus has ', h('strong', null, 'no accounts yet'), '. Your profile, saved items, requests and training history live in this browser only. Export a backup from Settings if you change device.'], 'info'),
    h('section', { class: 'settings-section', 'aria-labelledby': 'p-aud' },
      h('div', { class: 'settings-label' }, h('h2', { class: 'title', id: 'p-aud' }, 'Audience')),
      h('div', { class: 'settings-content stack' }, h('p', { class: 'body' }, audience ? `${AUDIENCE_INFO[audience].label} (${AUDIENCE_INFO[audience].ages})` : 'Not chosen yet'),
        h('div', { class: 'row' }, button('Change audience', () => chooseAudience(() => context.navigate('#/profile', true)), { variant: 'ghost' })))),
    h('section', { class: 'settings-section', 'aria-labelledby': 'p-loc' },
      h('div', { class: 'settings-label' }, h('h2', { class: 'title', id: 'p-loc' }, 'Location')),
      h('div', { class: 'settings-content stack' }, h('p', { class: 'body' }, location ? `${location.label} (${location.source === 'device' ? 'from your device, rounded to about 1 km' : 'typed by you'})` : 'No location saved.'),
        location ? h('div', { class: 'row' }, button('Forget location', () => { store.setLocation(null); toast('Location removed from this device.'); context.navigate('#/profile', true); }, { variant: 'ghost', icon: 'trash' })) : null)),
    h('section', { class: 'settings-section', 'aria-labelledby': 'p-train' },
      h('div', { class: 'settings-label' }, h('h2', { class: 'title', id: 'p-train' }, 'Training')),
      h('div', { class: 'settings-content stack' }, store.profile
        ? [h('p', { class: 'body' }, `${store.plans.length} plan${store.plans.length === 1 ? '' : 's'} · ${store.history.length} workout${store.history.length === 1 ? '' : 's'} logged`), h('div', { class: 'row' }, linkButton('Today', '#/today', { variant: 'ghost' }), linkButton('Settings', '#/settings', { variant: 'ghost', icon: 'settings' }))]
        : [h('p', { class: 'body' }, 'Set up training to get a plan built around you.'), h('div', { class: 'row' }, linkButton('Set up training', '#/onboarding', { variant: 'primary' }))])),
    h('section', { class: 'stack', 'aria-labelledby': 'p-req' }, sectionHead({ eyebrow: 'Requests', title: 'Enquiries and booking requests', id: 'p-req' }), requestsBox),
    h('section', { class: 'stack', 'aria-labelledby': 'p-saved' }, sectionHead({ eyebrow: 'Saved', title: 'Saved for later', id: 'p-saved' }), savedBox),
    h('section', { class: 'settings-section', 'aria-labelledby': 'p-data' },
      h('div', { class: 'settings-label' }, h('h2', { class: 'title', id: 'p-data' }, 'Your data')),
      h('div', { class: 'settings-content stack' },
        h('p', { class: 'small muted' }, 'Requests you have sent are also held by the Icarus server for the retention period shown in the privacy notice. Withdraw a request to erase your contact details from it.'),
        h('div', { class: 'row' },
          linkButton('Privacy notice', '#/privacy', { variant: 'ghost' }),
          button('Erase everything on this device', async () => {
            const ok = await confirmDialog({ title: 'Erase everything on this device?', text: 'This removes your audience, location, saved items, request references, plans and workout history from this browser. Requests already sent stay with the provider until they expire; withdraw them first if you want them erased.', confirm: 'Erase', danger: true });
            if (ok !== true) return;
            store.clearAll(); toast('Everything on this device was erased.'); context.navigate('#/welcome', true);
          }, { variant: 'danger', icon: 'trash' }))))));
  return { el, title: 'Profile', surface: 'light', nav: 'profile' };
}
