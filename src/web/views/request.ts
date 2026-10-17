import { AUDIENCE_INFO, PARTICIPANT_AGE_BANDS, requiresGuardian, safetyNote } from '../../shared/audience.js';
import { effectiveMonthly, money, totalDue } from '../../shared/marketplace/pricing.js';
import { emptyRequest, validateRequest, type FieldErrors, type RequestInput } from '../../shared/marketplace/requests.js';
import type { Quote, RequestKind, RequestStatus } from '../../shared/marketplace/types.js';
import { h, replace } from '../core/dom.js';
import { load, market, MarketError } from '../core/market.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { confirmDialog, eyebrow, linkButton, toast } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { demoBadge, field, notice } from '../ui/market-ui.js';

export const STATUS_TEXT: Record<RequestStatus, { label: string; text: string }> = {
  received: { label: 'Received, not yet confirmed', text: 'Icarus has recorded your request. It is not a booking: nothing is reserved and nothing has been charged.' },
  forwarded: { label: 'Sent to the provider, not yet confirmed', text: 'Your request was passed to the provider. They will contact you to confirm availability and the final price. Until then nothing is reserved.' },
  withdrawn: { label: 'Withdrawn', text: 'You withdrew this request and your contact details were erased from it.' },
};

/** The contact, guardian and consent part of every request form. */
export function detailsFields(input: RequestInput, errors: FieldErrors, options: { showMessage?: boolean; messageLabel?: string } = {}) {
  const guardian = requiresGuardian(input.audience);
  const text = (name: string, value: string, set: (value: string) => void, attrs: Record<string, string | number> = {}) =>
    h('input', { class: 'input', name, value, ...attrs, oninput: (event: Event) => set((event.target as HTMLInputElement).value) });
  return h('div', { class: 'stack', style: { '--stack': '18px' } },
    guardian ? notice(['Because this request is for a child, ', h('strong', null, 'a parent or guardian must make it'), '. We ask only for your details, never the child’s name, and providers contact you, not the child.'], 'safety') : null,
    h('div', { class: 'form-grid' },
      field({ name: 'contact.name', label: guardian ? 'Parent or guardian’s name' : 'Your name', error: errors['contact.name'], control: text('name', input.contact.name, v => { input.contact.name = v; }, { autocomplete: 'name', maxlength: 80 }) }),
      field({ name: 'contact.email', label: 'Email', error: errors['contact.email'], control: text('email', input.contact.email, v => { input.contact.email = v; }, { type: 'email', autocomplete: 'email', maxlength: 254 }) }),
      field({ name: 'contact.phone', label: 'Phone', optional: true, error: errors['contact.phone'], control: text('phone', input.contact.phone, v => { input.contact.phone = v; }, { type: 'tel', autocomplete: 'tel', maxlength: 20 }) }),
      field({ name: 'contact.preferred', label: 'Preferred contact', control: h('select', { class: 'input select', onchange: (event: Event) => { input.contact.preferred = (event.target as HTMLSelectElement).value as 'email' | 'phone'; } },
        h('option', { value: 'email', selected: input.contact.preferred === 'email' }, 'Email'), h('option', { value: 'phone', selected: input.contact.preferred === 'phone' }, 'Phone')) }),
      field({ name: 'participantAgeBand', label: guardian ? 'Child’s age range' : 'Age range', optional: !guardian, error: errors.participantAgeBand,
        control: h('select', { class: 'input select', onchange: (event: Event) => { const v = (event.target as HTMLSelectElement).value; input.participantAgeBand = v || null; } },
          h('option', { value: '' }, guardian ? 'Choose' : 'Prefer not to say'), PARTICIPANT_AGE_BANDS[input.audience].map(band => h('option', { value: band, selected: input.participantAgeBand === band }, band))) }),
      guardian ? field({ name: 'guardian.relationship', label: 'Your relationship to the child', error: errors['guardian.relationship'], hint: 'For example parent, legal guardian or carer.', control: text('relationship', input.guardian?.relationship ?? '', v => { if (input.guardian) input.guardian.relationship = v; }, { maxlength: 40 }) }) : null),
    options.showMessage !== false ? field({ name: 'message', label: options.messageLabel ?? 'Message', optional: input.kind !== 'enquiry' && input.kind !== 'support', error: errors.message,
      hint: 'Please do not include medical details. The provider will ask what they need.',
      control: h('textarea', { class: 'input textarea', rows: 4, maxlength: 1000, value: input.message, oninput: (event: Event) => { input.message = (event.target as HTMLTextAreaElement).value; } }) }) : null,
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: input.healthFlag, onchange: (event: Event) => { input.healthFlag = (event.target as HTMLInputElement).checked; } }),
      guardian ? 'The child has a health condition or injury the provider should discuss with me first' : 'I have a health condition, injury or am pregnant, and want to discuss it before starting'),
    h('fieldset', { class: 'field consent' }, h('legend', { class: 'label' }, 'Consent'),
      guardian ? h('div', { class: `check-wrap${errors['guardian.consent'] ? ' has-error' : ''}`, dataset: { field: 'guardian.consent' } }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: Boolean(input.guardian?.consent), 'aria-invalid': errors['guardian.consent'] ? 'true' : null, onchange: (event: Event) => { if (input.guardian) input.guardian.consent = (event.target as HTMLInputElement).checked; } }),
        'I am the child’s parent or legal guardian and I consent to this request on their behalf.'), errors['guardian.consent'] ? h('p', { class: 'field-error' }, errors['guardian.consent']) : null) : null,
      h('div', { class: `check-wrap${errors['consent.contact'] ? ' has-error' : ''}`, dataset: { field: 'consent.contact' } }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: input.consent.contact, 'aria-invalid': errors['consent.contact'] ? 'true' : null, onchange: (event: Event) => { input.consent.contact = (event.target as HTMLInputElement).checked; } }),
        'The provider may contact me about this request.'), errors['consent.contact'] ? h('p', { class: 'field-error' }, errors['consent.contact']) : null),
      h('div', { class: `check-wrap${errors['consent.privacy'] ? ' has-error' : ''}`, dataset: { field: 'consent.privacy' } }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: input.consent.privacy, 'aria-invalid': errors['consent.privacy'] ? 'true' : null, onchange: (event: Event) => { input.consent.privacy = (event.target as HTMLInputElement).checked; } }),
        'I have read ', h('a', { href: '#/privacy', target: '_blank' }, 'how my details are used'), '.'), errors['consent.privacy'] ? h('p', { class: 'field-error' }, errors['consent.privacy']) : null)),
    // Honeypot for bots: hidden from people and assistive technology.
    h('div', { class: 'hp', 'aria-hidden': 'true' }, h('label', null, 'Website', h('input', { type: 'text', tabindex: '-1', autocomplete: 'off', oninput: (event: Event) => { input.website = (event.target as HTMLInputElement).value; } }))));
}

export function quoteBlock(quote: Quote | null) {
  if (!quote) return null;
  return h('div', { class: 'quote' },
    h('dl', { class: 'review-list' }, quote.lines.map(line => h('div', null, h('dt', null, line.label), h('dd', { class: 'numeral-cell' }, money(line.amount, quote.currency)))),
      h('div', { class: 'quote-total' }, h('dt', null, 'Estimated total'), h('dd', { class: 'numeral-cell' }, money(quote.total, quote.currency)))),
    h('p', { class: 'small muted' }, quote.note));
}

/** Validates locally, submits, keeps the reference on this device and opens the confirmation. */
export async function submitRequest(input: RequestInput, show: (errors: FieldErrors) => void, submit: HTMLButtonElement, navigate: (hash: string) => void) {
  const errors = validateRequest(input);
  if (Object.keys(errors).length) { show(errors); return; }
  submit.disabled = true;
  const label = submit.textContent;
  submit.textContent = 'Sending…';
  try {
    const created = await market.submit(input);
    if ('ignored' in created) { toast('Your request could not be sent.', { kind: 'error' }); return; }
    try { store.addRequest({ ref: created.ref, token: created.token, kind: created.kind, summary: created.summary.slice(0, 300), createdAt: created.createdAt, status: created.status }); }
    catch { toast('Your request was sent, but this browser could not keep a copy. Note the reference on the next page.', { kind: 'error', ms: 10000 }); }
    navigate(`#/requests/${created.ref}?new=1`);
  } catch (error) {
    if (error instanceof MarketError && Object.keys(error.fields).length) show(error.fields);
    else toast(error instanceof Error ? error.message : 'Could not send your request.', { kind: 'error' });
  } finally { submit.disabled = false; submit.textContent = label; }
}

/** Focuses the first field with an error so keyboard and screen reader users find it. */
export function focusFirstError(root: HTMLElement) {
  queueMicrotask(() => {
    const target = root.querySelector<HTMLElement>('.has-error input, .has-error select, .has-error textarea, [aria-invalid="true"]');
    target?.focus();
    target?.scrollIntoView({ block: 'center' });
  });
}

/** Membership enquiries and general enquiries to a gym or professional. */
export function enquireView(context: ViewContext): View {
  const audience = store.audience();
  const kind: RequestKind = context.query.get('kind') === 'membership' ? 'membership' : 'enquiry';
  const input = emptyRequest(kind, audience);
  input.gymId = context.query.get('gym');
  input.planId = kind === 'membership' ? context.query.get('plan') : null;
  const pro = context.query.get('pro');
  if (pro) { if (context.query.get('role') === 'nutritionist') input.nutritionistId = pro; else input.trainerId = pro; }
  let errors: FieldErrors = {};

  const summary = h('div', { class: 'enquiry-summary' });
  const formBody = h('div');
  const submit = h('button', { type: 'submit', class: 'btn primary' }, kind === 'membership' ? 'Send membership enquiry' : 'Send enquiry') as HTMLButtonElement;
  const draw = () => replace(formBody, detailsFields(input, errors, { messageLabel: kind === 'membership' ? 'Anything the gym should know?' : 'Your message' }));
  const form = h('form', { class: 'stack', style: { '--stack': '24px' }, novalidate: true, onsubmit: (event: Event) => {
    event.preventDefault();
    void submitRequest(input, next => { errors = next; draw(); focusFirstError(form); }, submit, context.navigate);
  } }, formBody, h('div', { class: 'row' }, submit, linkButton('Cancel', input.gymId ? `#/gyms/${input.gymId}` : '#/gyms', { variant: 'ghost' })),
    h('p', { class: 'small muted' }, 'This sends an enquiry, not a booking or a payment. The provider replies to confirm.'));
  draw();

  void load(summary, async () => {
    if (input.gymId) return { gym: (await market.gym(input.gymId)).gym, pro: null };
    if (pro) return { gym: null, pro: (await market.professional(pro)).professional };
    return { gym: null, pro: null };
  }, ({ gym, pro: professional }) => {
    if (professional) { if (professional.role === 'nutritionist') { input.nutritionistId = professional.id; input.trainerId = null; } }
    const plan = gym?.memberships.find(item => item.id === input.planId);
    if (kind === 'membership' && gym && !plan) return notice('That plan is no longer listed. Go back and choose another.', 'warn');
    if (plan && !plan.audiences.includes(audience)) return notice(`This plan is not offered to ${AUDIENCE_INFO[audience].label.toLowerCase()}. Choose a different plan or switch audience.`, 'warn');
    const due = plan ? totalDue(plan) : null;
    return h('div', { class: 'stack', style: { '--stack': '10px' } },
      h('div', { class: 'row' }, h('p', { class: 'eyebrow' }, kind === 'membership' ? 'Membership enquiry' : 'Enquiry'), (gym ?? professional)?.demo ? demoBadge() : null),
      h('p', { class: 'title' }, gym ? gym.name : professional ? professional.name : 'Icarus'),
      plan && gym && due ? h('dl', { class: 'review-list' },
        h('div', null, h('dt', null, 'Plan'), h('dd', null, `${plan.name}, ${plan.months} month${plan.months === 1 ? '' : 's'}`)),
        h('div', null, h('dt', null, 'Membership'), h('dd', null, `${money(plan.price, gym.currency)} (${money(effectiveMonthly(plan), gym.currency)} per month)`)),
        due.joiningFee ? h('div', null, h('dt', null, 'Joining fee'), h('dd', null, money(due.joiningFee, gym.currency))) : null,
        due.deposit ? h('div', null, h('dt', null, 'Refundable deposit'), h('dd', null, money(due.deposit, gym.currency))) : null,
        h('div', { class: 'quote-total' }, h('dt', null, 'Total due'), h('dd', null, money(due.total, gym.currency)))) : null,
      notice(safetyNote(audience), 'safety'));
  });

  const el = h('div', { class: 'page surface-light enquire' }, h('div', { class: 'container' },
    h('a', { class: 'text-link small back-link', href: input.gymId ? `#/gyms/${input.gymId}` : '#/gyms' }, icon('arrow-left'), 'Back'),
    h('header', { class: 'page-head' }, eyebrow(kind === 'membership' ? 'Enquire' : 'Contact'), h('h1', { class: 'headline' }, kind === 'membership' ? 'Ask about this membership' : 'Send an enquiry')),
    h('div', { class: 'enquire-layout' }, form, h('aside', null, summary))));
  return { el, title: 'Enquiry', surface: 'light', nav: 'gyms' };
}

/** Confirmation and status page for a submitted request. Accurate about what has and has not happened. */
export function requestView(context: ViewContext): View {
  const ref = context.params.ref;
  const local = store.local.requests.find(item => item.ref === ref);
  const fresh = context.query.get('new') === '1';
  const body = h('div', { class: 'stack', style: { '--stack': '28px' } });
  const el = h('div', { class: 'page surface-light request-page' }, h('div', { class: 'container narrow' }, body));
  if (!local) {
    body.append(eyebrow('Request'), h('h1', { class: 'headline' }, 'Request not found on this device'),
      h('p', { class: 'body' }, 'Requests can be viewed only from the browser that sent them. If you sent it elsewhere, open it there, or contact the provider with your reference.'),
      linkButton('Your profile', '#/profile', { variant: 'ghost' }));
    return { el, title: 'Request', surface: 'light', nav: 'profile' };
  }
  void load(body, () => market.status(local.ref, local.token), record => {
    if (record.status !== local.status) { try { store.updateRequest(local.ref, { status: record.status }); } catch { /* display still correct */ } }
    const status = STATUS_TEXT[record.status];
    return [
      h('div', { class: 'confirmation-mark', 'aria-hidden': 'true' }, icon(record.status === 'withdrawn' ? 'close' : 'check')),
      eyebrow(fresh ? 'Request sent' : 'Request'),
      h('h1', { class: 'headline' }, fresh ? 'We have your request.' : record.summary.split(' · ')[0]),
      h('div', { class: 'status-card' },
        h('dl', { class: 'review-list' },
          h('div', null, h('dt', null, 'Reference'), h('dd', { class: 'numeral-cell ref' }, record.ref)),
          h('div', null, h('dt', null, 'Status'), h('dd', null, h('span', { class: `badge status-${record.status}` }, status.label))),
          h('div', null, h('dt', null, 'Request'), h('dd', null, record.summary)),
          h('div', null, h('dt', null, 'Sent'), h('dd', null, new Date(record.createdAt).toLocaleString())))),
      h('p', { class: 'body' }, status.text),
      quoteBlock(record.quote),
      record.status !== 'withdrawn' ? h('section', { class: 'stack', 'aria-labelledby': 'next' }, h('h2', { class: 'eyebrow', id: 'next' }, 'What happens next'),
        h('ol', { class: 'steps compact', role: 'list' },
          h('li', null, h('span', { class: 'numeral' }, '01'), h('p', { class: 'small' }, record.forwarded ? 'The provider has your request.' : store.config?.requestsForwarded ? 'Icarus is passing your request to the provider.' : 'This demonstration does not forward requests to real providers. In a live deployment the provider receives it at once.')),
          h('li', null, h('span', { class: 'numeral' }, '02'), h('p', { class: 'small' }, 'They contact you to confirm availability, times and the final price.')),
          h('li', null, h('span', { class: 'numeral' }, '03'), h('p', { class: 'small' }, 'You pay the provider directly only after you agree. Icarus never takes payment.')))) : null,
      h('div', { class: 'row' },
        linkButton('Your requests', '#/profile', { variant: 'ghost' }),
        record.status !== 'withdrawn' ? h('button', { type: 'button', class: 'btn ghost danger-text', onclick: async () => {
          const ok = await confirmDialog({ title: 'Withdraw this request?', text: 'The provider will no longer act on it and your contact details are erased from it. This cannot be undone.', confirm: 'Withdraw', danger: true });
          if (ok !== true) return;
          try { const next = await market.withdraw(local.ref, local.token); store.updateRequest(local.ref, { status: next.status }); toast('Request withdrawn.'); context.navigate(`#/requests/${local.ref}`, true); }
          catch (error) { toast(error instanceof Error ? error.message : 'Could not withdraw.', { kind: 'error' }); }
        } }, 'Withdraw request') : null),
    ];
  });
  return { el, title: 'Request', surface: 'light', nav: 'profile' };
}
