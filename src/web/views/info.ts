import { emptyRequest, type FieldErrors } from '../../shared/marketplace/requests.js';
import { h, replace, type Child } from '../core/dom.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { eyebrow } from '../ui/components.js';
import { notice } from '../ui/market-ui.js';
import { footer } from './home.js';
import { detailsFields, focusFirstError, submitRequest } from './request.js';

function doc(title: string, lead: string, sections: [string, Child][], extra: Child = null) {
  return h('div', { class: 'page surface-light info-page' }, h('div', { class: 'container narrow stack', style: { '--stack': '36px' } },
    h('header', { class: 'page-head' }, eyebrow('Icarus'), h('h1', { class: 'display' }, title), h('p', { class: 'lead' }, lead)),
    notice('This page describes how this software works. It has not been reviewed by a lawyer and is not a statement of legal compliance. Whoever operates a public deployment must adapt it to the laws that apply to them.', 'warn'),
    sections.map(([heading, body]) => h('section', { class: 'stack prose-section' }, h('h2', { class: 'title' }, heading), body)), extra), footer());
}
const p = (...text: Child[]) => h('p', { class: 'body' }, ...text);
const ul = (...items: string[]) => h('ul', { class: 'bullet-list', role: 'list' }, items.map(item => h('li', null, item)));

export function privacyView(): View {
  const days = store.config?.retentionDays ?? 90;
  const el = doc('Privacy', 'What Icarus collects, where it is kept, and how to remove it.', [
    ['In short', ul('There are no accounts. Your profile, plans, workouts, saved items and meal notes stay in this browser.', 'The server receives information only when you send a request, ask the AI coach, or search for gyms.', 'Location is used only if you choose to share it, and is rounded to about 1 km first.', 'Icarus does not sell data, show advertising or use tracking cookies.')],
    ['Kept in your browser', p('Audience choice, rounded location, saved items, comparison list, request references, dietary preferences, meal organiser, training profile, plans, workout history and app settings. Clear them from Profile or Settings, or by clearing this site’s data in your browser.')],
    ['Sent to the server', ul(
      'Gym searches: your filters and, if you set one, the rounded location. These are not stored.',
      `Enquiries and booking requests: the contact details, preferences and message you type. Stored for ${days} days, then deleted automatically. Withdraw a request to erase your contact details sooner.`,
      'AI coach: your message and a short summary of your training, sent to the provider you choose (see below). Message content is never written to server logs.')],
    ['Shared with providers', p('When a deployment is connected to gyms or professionals, your request is passed to the provider you chose so they can reply. In this demonstration requests are not passed to anyone, because the listings are fictional.')],
    ['AI providers', p('If you choose Claude (Anthropic) or OpenAI as your coach, your messages go to that company and are handled under its terms. The built-in coach runs on the Icarus server and sends nothing elsewhere.')],
    ['Children', ul('Requests for a child are made by a parent or guardian, who gives consent and is the only contact.', 'We do not ask for a child’s name, and no child profile is shown anywhere.', 'Adult weight-loss programmes, calorie targets and individual meal plans are not offered for children.')],
    ['Health information', p('Forms ask only whether there is something to discuss, never for details. Please do not type medical information into messages; the provider will ask what they need directly.')],
    ['Your choices', ul('See and erase everything on this device from Profile.', 'Withdraw a request from its page to erase your contact details from it.', 'Decline location and type a place instead.')],
    ['Contact', p(store.config?.supportEmail ? ['Email ', h('a', { href: `mailto:${store.config.supportEmail}` }, store.config.supportEmail), ' or use the ', h('a', { href: '#/support' }, 'support form'), '.'] : ['Use the ', h('a', { href: '#/support' }, 'support form'), '.'])],
  ]);
  return { el, title: 'Privacy', surface: 'light', nav: 'privacy' };
}

export function termsView(): View {
  const el = doc('Terms of use', 'The ground rules for using Icarus.', [
    ['What Icarus is', p('A place to discover gyms, compare memberships, request coaching and nutrition support, and follow training plans. Icarus is not a gym, a healthcare provider or a payment service.')],
    ['Demonstration listings', p('Gyms, professionals, prices and offers marked “Demo” are fictional examples. They are not real businesses and cannot be booked.')],
    ['Requests are not bookings', p('Sending an enquiry or booking request does not reserve a place or create a contract. The provider confirms availability and price directly with you, and you pay them directly if you agree.')],
    ['Prices and verification', p('Prices are shown as listed by providers. Qualifications are labelled verified only when they have been checked; otherwise they are as stated by the professional. Reviews are shown only from verified sources.')],
    ['Health and safety', p('Training and nutrition content is general information for healthy people, not medical advice. Check with a doctor before starting if you have a health condition, are pregnant, or are returning from injury. Stop if you feel pain, dizziness or chest discomfort. Children must be supervised by a responsible adult or a qualified coach.')],
    ['Acceptable use', ul('Give accurate contact details and only make requests you intend to follow up.', 'Do not submit requests for a child unless you are their parent or legal guardian.', 'Do not misuse, overload or try to break the service.')],
    ['Changes', p('These terms may change as the service develops. The version on this page applies.')],
  ]);
  return { el, title: 'Terms', surface: 'light', nav: 'terms' };
}

export function supportView(context: ViewContext): View {
  const input = emptyRequest('support', 'adults');
  input.guardian = null;
  let errors: FieldErrors = {};
  const body = h('div');
  const submit = h('button', { type: 'submit', class: 'btn primary' }, 'Send message') as HTMLButtonElement;
  const draw = () => replace(body, detailsFields(input, errors, { messageLabel: 'How can we help?' }));
  draw();
  const form = h('form', { class: 'stack', style: { '--stack': '20px' }, novalidate: true, onsubmit: (event: Event) => {
    event.preventDefault();
    void submitRequest(input, fields => { errors = fields; draw(); focusFirstError(form); }, submit, context.navigate);
  } }, body, h('div', { class: 'row' }, submit));
  const email = store.config?.supportEmail;
  const el = doc('Support', 'Questions about a request, your data or how Icarus works.', [
    ['Common questions', ul(
      'Is my booking confirmed? Not until the provider contacts you. Your request page shows its status.',
      'Can I change my request? Withdraw it from its page and send a new one.',
      'Where is my data? In this browser. See Profile to review or erase it.')],
    ['Contact', email ? p('Email ', h('a', { href: `mailto:${email}` }, email), ' or use the form below.') : p('Use the form below. Messages are kept for the retention period in the privacy notice.')],
  ], h('section', { class: 'stack' }, h('h2', { class: 'title' }, 'Send a message'), form));
  return { el, title: 'Support', surface: 'light', nav: 'support' };
}
