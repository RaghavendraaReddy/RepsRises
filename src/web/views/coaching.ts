import { AUDIENCE_INFO, safetyNote } from '../../shared/audience.js';
import { money, packageQuote } from '../../shared/marketplace/pricing.js';
import { emptyRequest, validateRequest, type FieldErrors, type Format, type RequestInput } from '../../shared/marketplace/requests.js';
import type { City, PackageTemplate, Professional } from '../../shared/marketplace/types.js';
import { h, replace } from '../core/dom.js';
import { load, market, type MarketInfo } from '../core/market.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { button, eyebrow, linkButton } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { audienceSwitch, demoBadge, gymCard, notice, proCard, qualification, saveButton, sectionHead } from '../ui/market-ui.js';
import { detailsFields, focusFirstError, quoteBlock, submitRequest } from './request.js';

const FORMAT_LABEL: Record<Format, string> = { 'in-person': 'In person', online: 'Online', hybrid: 'Hybrid (in person and online)' };

/** Lowest estimate for a package from professionals who could deliver it in a city. */
function fromEstimate(pack: PackageTemplate, pros: Professional[]) {
  const fits = (pro: Professional) => pro.audiences.some(item => pack.audiences.includes(item)) && pro.formats.some(format => pack.formats.includes(format));
  const trainers = pack.trainingSessions ? pros.filter(pro => pro.role === 'trainer' && fits(pro)) : [null];
  const nutritionists = pack.nutritionConsults ? pros.filter(pro => pro.role === 'nutritionist' && fits(pro)) : [null];
  let best: number | null = null;
  for (const trainer of trainers) for (const nutritionist of nutritionists) {
    const quote = packageQuote(pack, trainer, nutritionist);
    if (quote && (best === null || quote.total < best)) best = quote.total;
  }
  return best;
}

export function coachingView(context: ViewContext): View {
  const audience = store.audience();
  const cityId = context.query.get('city') ?? store.local.location?.cityId ?? 'bengaluru';
  const role = context.query.get('role') === 'nutritionist' ? 'nutritionist' : context.query.get('role') === 'trainer' ? 'trainer' : '';
  const packages = h('div', { class: 'package-list' });
  const directory = h('div', { class: 'pro-grid' });
  const cityChips = h('div', { class: 'row', role: 'group', 'aria-label': 'City' });

  void load(packages, async () => ({ info: await market.info(), pros: (await market.professionals({ city: cityId, audience })).results }), ({ info, pros }) => {
    cityChips.replaceChildren(...info.cities.map(city => h('a', { class: 'chip', href: `#/coaching?city=${city.id}${role ? `&role=${role}` : ''}`, 'aria-pressed': String(city.id === cityId) }, city.name)));
    const list = info.packages.filter(pack => pack.audiences.includes(audience));
    const currency = info.cities.find(city => city.id === cityId)?.currency ?? 'INR';
    if (!list.length) return h('p', { class: 'muted' }, 'No packages for this audience yet.');
    return list.map(pack => {
      const estimate = fromEstimate(pack, pros);
      return h('article', { class: 'package-card' },
        h('div', { class: 'package-main stack', style: { '--stack': '10px' } },
          h('div', { class: 'row' }, h('p', { class: 'tag' }, `${pack.weeks} weeks · ${pack.formats.map(item => FORMAT_LABEL[item].split(' ')[0]).join(' / ')}`), saveButton('packages', pack.id, pack.name, { compact: true })),
          h('h3', { class: 'title' }, pack.name), h('p', { class: 'small' }, pack.summary),
          h('ul', { class: 'mini-facts', role: 'list' },
            pack.trainingSessions ? h('li', null, `${pack.trainingSessions} personal training sessions`) : null,
            pack.nutritionConsults ? h('li', null, `${pack.nutritionConsults} nutrition consultations`) : null,
            pack.mealPlanning ? h('li', null, 'Personal meal planning') : null,
            h('li', null, pack.assessments), h('li', null, pack.followUps))),
        h('div', { class: 'package-side stack', style: { '--stack': '10px' } },
          estimate !== null ? h('p', null, h('span', { class: 'small muted' }, 'From '), h('strong', { class: 'numeral' }, money(estimate, currency)), h('span', { class: 'small muted' }, ' estimated, in this city')) : h('p', { class: 'small muted' }, 'No team available in this city yet.'),
          h('p', { class: 'small muted' }, 'Built from each professional’s listed rate. Confirmed by the provider.'),
          estimate !== null ? linkButton('Choose this package', `#/coaching/${pack.id}?city=${cityId}`, { variant: 'primary', iconAfter: 'arrow' }) : null));
    });
  });

  void load(directory, () => market.professionals({ city: cityId, audience, ...(role ? { role } : {}) }), data => data.results.length ? data.results.map(pro => proCard(pro)) : [h('p', { class: 'muted' }, 'No professionals match in this city for this audience.')]);

  const roleChips = h('div', { class: 'row', role: 'group', 'aria-label': 'Role' }, ([['', 'Everyone'], ['trainer', 'Trainers'], ['nutritionist', 'Nutritionists']] as const).map(([value, label]) =>
    h('a', { class: 'chip', href: `#/coaching?city=${cityId}${value ? `&role=${value}` : ''}`, 'aria-pressed': String(role === value) }, label)));

  const el = h('div', { class: 'page surface-light coaching' }, h('div', { class: 'container stack', style: { '--stack': '56px' } },
    h('header', { class: 'page-head' }, eyebrow('Personal training & nutrition'), h('h1', { class: 'display' }, 'Build your ', h('em', null, 'coaching team.')),
      h('p', { class: 'lead' }, 'One package, a trainer and a nutritionist working from the same plan. Pick the package, choose the people, and send a single booking request.'), h('div', { class: 'row' }, audienceSwitch())),
    notice('The professionals listed here are demonstration profiles. Their qualifications are shown as not verified because no verification has been carried out.', 'warn'),
    audience === 'kids' ? notice('For children, packages focus on supervised training and movement skills. Individual meal plans and weight-loss programmes are not offered to children; talk to your child’s doctor or a registered paediatric dietitian about nutrition.', 'safety') : null,
    h('section', { class: 'stack', 'aria-labelledby': 'pk' }, sectionHead({ eyebrow: 'Packages', title: ['Choose how much ', h('em', null, 'support you want.')], id: 'pk' }), cityChips, packages),
    h('section', { class: 'stack', 'aria-labelledby': 'dir' }, sectionHead({ eyebrow: 'Directory', title: 'Trainers and nutritionists', id: 'dir', lead: `Working with ${AUDIENCE_INFO[audience].label.toLowerCase()} in this city.` }), roleChips, directory)));
  return { el, title: 'Personal training', surface: 'light', nav: 'coaching' };
}

export function proView(context: ViewContext): View {
  const body = h('div', { class: 'container' });
  const el = h('div', { class: 'page surface-light pro-page' }, body);
  void load(body, () => market.professional(context.params.id), ({ professional: pro, gyms }) => {
    document.title = `${pro.name} · Icarus`;
    const audience = store.audience();
    return [
      h('a', { class: 'text-link small back-link', href: '#/coaching' }, icon('arrow-left'), 'Personal training'),
      h('header', { class: 'pro-hero' },
        h('span', { class: 'monogram large', 'aria-hidden': 'true' }, pro.initials),
        h('div', { class: 'stack', style: { '--stack': '10px' } },
          h('div', { class: 'row' }, eyebrow(pro.role === 'trainer' ? 'Personal trainer' : 'Nutritionist'), pro.demo ? demoBadge('Demo profile') : null),
          h('h1', { class: 'display' }, pro.name), h('p', { class: 'lead' }, pro.specialties.join(' · ')),
          h('div', { class: 'row' }, saveButton('professionals', pro.id, pro.name),
            linkButton('Send an enquiry', `#/enquire?kind=enquiry&pro=${pro.id}&role=${pro.role}`, { variant: 'ghost', icon: 'mail' }),
            linkButton('Book in a package', '#/coaching', { variant: 'primary' })))),
      !pro.audiences.includes(audience) ? notice(`${pro.name} does not list work with ${AUDIENCE_INFO[audience].label.toLowerCase()}.`, 'warn') : null,
      h('div', { class: 'gym-columns' },
        h('div', { class: 'stack', style: { '--stack': '36px' } },
          h('section', { class: 'stack' }, h('h2', { class: 'eyebrow' }, 'About'), h('p', { class: 'body' }, pro.bio)),
          h('section', { class: 'stack' }, h('h2', { class: 'eyebrow' }, 'Qualifications'), h('ul', { class: 'qualification-list', role: 'list' }, pro.qualifications.map(qualification)),
            h('p', { class: 'small muted' }, 'Verified means Icarus has checked the certificate with its issuer. Unverified qualifications are as stated by the professional.')),
          pro.role === 'nutritionist' ? notice('Nutritionists on Icarus give general nutrition guidance and meal planning. They do not diagnose or treat medical conditions; for those, see a doctor or registered dietitian.', 'safety') : null),
        h('aside', { class: 'gym-aside stack' },
          h('dl', { class: 'review-list' },
            h('div', null, h('dt', null, 'Experience'), h('dd', null, `${pro.experienceYears} years`)),
            h('div', null, h('dt', null, pro.role === 'trainer' ? 'Per session' : 'Per consultation'), h('dd', null, money(pro.rate, pro.currency))),
            pro.mealPlanFee ? h('div', null, h('dt', null, 'Meal planning'), h('dd', null, `${money(pro.mealPlanFee, pro.currency)} per month`)) : null,
            h('div', null, h('dt', null, 'Formats'), h('dd', null, pro.formats.map(item => FORMAT_LABEL[item]).join(', '))),
            h('div', null, h('dt', null, 'Areas'), h('dd', null, pro.areas.join(', '))),
            h('div', null, h('dt', null, 'Works with'), h('dd', null, pro.audiences.map(item => AUDIENCE_INFO[item].label).join(', '))),
            h('div', null, h('dt', null, 'Languages'), h('dd', null, pro.languages.join(', '))),
            h('div', null, h('dt', null, 'Availability'), h('dd', null, pro.availability))))),
      gyms.length ? h('section', { class: 'stack' }, h('h2', { class: 'headline' }, 'Works at'), h('div', { class: 'gym-grid' }, gyms.map(gym => gymCard(gym)))) : null,
    ].filter(Boolean) as HTMLElement[];
  });
  return { el, title: 'Professional', surface: 'light', nav: 'coaching' };
}

const STEPS = ['Package', 'Team', 'Location & format', 'Dates', 'Your details', 'Review'] as const;

/** Seven steps: the six screens here, then the confirmation page. */
export function bookingView(context: ViewContext): View {
  const audience = store.audience();
  const input = emptyRequest('coaching', audience);
  input.packageId = context.params.id;
  let cityId = context.query.get('city') ?? store.local.location?.cityId ?? 'bengaluru';
  let step = 0;
  let errors: FieldErrors = {};
  let info: MarketInfo | null = null;
  let pros: Professional[] = [];

  const main = h('div', { class: 'wizard-main' });
  const progress = h('ol', { class: 'wizard-steps', role: 'list', 'aria-label': 'Booking steps' });
  const side = h('aside', { class: 'wizard-side' });
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });

  const pack = () => info?.packages.find(item => item.id === input.packageId);
  const trainer = () => pros.find(item => item.id === input.trainerId) ?? null;
  const nutritionist = () => pros.find(item => item.id === input.nutritionistId) ?? null;
  const city = (): City | undefined => info?.cities.find(item => item.id === cityId);
  const formats = () => {
    const p = pack();
    if (!p) return [];
    return p.formats.filter(format => [trainer(), nutritionist()].every(pro => !pro || pro.formats.includes(format)));
  };

  const stepErrors = (index: number): FieldErrors => {
    const p = pack(), result: FieldErrors = {};
    if (index >= 0 && (!p || !p.audiences.includes(audience))) result.packageId = 'Choose a package offered for this audience.';
    if (index >= 1 && p) {
      if (p.trainingSessions && !trainer()) result.trainerId = 'Choose a trainer.';
      if (p.nutritionConsults && !nutritionist()) result.nutritionistId = 'Choose a nutritionist.';
    }
    if (index >= 2) {
      if (!input.format) result.format = 'Choose how you want to meet.';
      if (input.format && input.format !== 'online' && !input.area) result.area = 'Choose the area where you would like to train.';
    }
    if (index >= 3 && !input.preferredDates.length) result.preferredDates = 'Choose at least one preferred start date.';
    if (index >= 4) Object.assign(result, validateRequest(input));
    return result;
  };

  const next = () => {
    errors = stepErrors(step);
    if (Object.keys(errors).length) { draw(); focusFirstError(main); return; }
    step = Math.min(STEPS.length - 1, step + 1); errors = {}; draw(true);
  };
  const back = () => { if (step > 0) { step -= 1; errors = {}; draw(true); } else context.navigate(`#/coaching?city=${cityId}`); };

  const errorText = (key: string) => errors[key] ? h('p', { class: 'field-error', role: 'alert' }, errors[key]) : null;

  const screens: (() => Node)[] = [
    () => h('fieldset', { class: 'stack', style: { '--stack': '12px' } }, h('legend', { class: 'title' }, 'Choose a package'), errorText('packageId'),
      (info?.packages ?? []).filter(item => item.audiences.includes(audience)).map(item => h('label', { class: `package-option${item.id === input.packageId ? ' selected' : ''}` },
        h('input', { type: 'radio', name: 'package', checked: item.id === input.packageId, onchange: () => { input.packageId = item.id; input.trainerId = null; input.nutritionistId = null; input.format = null; draw(); } }),
        h('span', { class: 'stack', style: { '--stack': '4px' } }, h('span', { class: 'title' }, item.name), h('span', { class: 'small' }, item.summary),
          h('span', { class: 'tag' }, [`${item.weeks} weeks`, item.trainingSessions ? `${item.trainingSessions} sessions` : '', item.nutritionConsults ? `${item.nutritionConsults} consultations` : '', item.mealPlanning ? 'meal planning' : ''].filter(Boolean).join(' · ')))))),
    () => {
      const p = pack()!;
      const suit = (pro: Professional) => pro.audiences.includes(audience) && pro.formats.some(format => p.formats.includes(format));
      const group = (role: 'trainer' | 'nutritionist', title: string, selected: string | null, set: (id: string) => void) => {
        const list = pros.filter(pro => pro.role === role && suit(pro));
        return h('fieldset', { class: 'stack', style: { '--stack': '12px' }, dataset: { field: role === 'trainer' ? 'trainerId' : 'nutritionistId' } }, h('legend', { class: 'title' }, title), errorText(role === 'trainer' ? 'trainerId' : 'nutritionistId'),
          list.length ? h('div', { class: 'pro-grid' }, list.map(pro => proCard(pro, { select: { selected: pro.id === selected, name: role, onSelect: () => { set(pro.id); input.format = null; draw(); } } })))
            : h('p', { class: 'muted' }, `No ${role}s are available for this package in ${city()?.name ?? 'this city'}.`));
      };
      return h('div', { class: 'stack', style: { '--stack': '28px' } },
        h('div', { class: 'field' }, h('label', { for: 'wiz-city' }, 'City'), h('select', { id: 'wiz-city', class: 'input select', onchange: (event: Event) => { cityId = (event.target as HTMLSelectElement).value; input.trainerId = null; input.nutritionistId = null; input.area = null; void refreshPros(); } },
          (info?.cities ?? []).map(item => h('option', { value: item.id, selected: item.id === cityId }, item.name)))),
        p.trainingSessions ? group('trainer', 'Choose your trainer', input.trainerId, id => { input.trainerId = id; }) : null,
        p.nutritionConsults ? group('nutritionist', 'Choose your nutritionist', input.nutritionistId, id => { input.nutritionistId = id; }) : null);
    },
    () => {
      const available = formats();
      const areas = [...new Set([...(trainer()?.areas ?? []), ...(nutritionist()?.areas ?? [])])];
      return h('div', { class: 'stack', style: { '--stack': '28px' } },
        h('fieldset', { class: 'stack', style: { '--stack': '10px' }, dataset: { field: 'format' } }, h('legend', { class: 'title' }, 'How would you like to meet?'), errorText('format'),
          available.length ? available.map(format => h('label', { class: 'check radio-row' }, h('input', { type: 'radio', name: 'format', checked: input.format === format, onchange: () => { input.format = format; if (format === 'online') input.area = null; draw(); } }), FORMAT_LABEL[format]))
            : h('p', { class: 'muted' }, 'Your trainer and nutritionist have no format in common for this package. Go back and choose a different team.')),
        input.format && input.format !== 'online' ? h('div', { class: `field${errors.area ? ' has-error' : ''}`, dataset: { field: 'area' } }, h('label', { for: 'wiz-area' }, 'Area for in-person sessions'),
          h('select', { id: 'wiz-area', class: 'input select', 'aria-invalid': errors.area ? 'true' : null, onchange: (event: Event) => { input.area = (event.target as HTMLSelectElement).value || null; } },
            h('option', { value: '' }, 'Choose an area'), areas.map(area => h('option', { value: area, selected: input.area === area }, `${area}, ${city()?.name ?? ''}`))), errorText('area')) : null);
    },
    () => {
      const today = new Date(), min = today.toISOString().slice(0, 10), maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 180);
      const dates = [0, 1, 2].map(index => h('div', { class: 'field' }, h('label', { for: `wiz-date-${index}` }, index ? `Alternative date ${index}` : 'Preferred start date', index ? h('span', { class: 'muted small' }, ' (optional)') : null),
        h('input', { id: `wiz-date-${index}`, class: 'input', type: 'date', min, max: maxDate.toISOString().slice(0, 10), value: input.preferredDates[index] ?? '',
          'aria-invalid': errors.preferredDates && index === 0 ? 'true' : null,
          onchange: (event: Event) => { const all = [0, 1, 2].map(i => (main.querySelector<HTMLInputElement>(`#wiz-date-${i}`)?.value ?? '')); input.preferredDates = [...new Set(all.filter(Boolean))]; void event; } })));
      return h('div', { class: 'stack', style: { '--stack': '24px' } },
        h('fieldset', { class: `stack${errors.preferredDates ? ' has-error' : ''}`, style: { '--stack': '14px' }, dataset: { field: 'preferredDates' } }, h('legend', { class: 'title' }, 'When would you like to start?'),
          h('p', { class: 'small muted' }, 'These are preferences. The team replies with times they can actually offer.'), errorText('preferredDates'), h('div', { class: 'form-grid' }, dates)),
        h('div', { class: 'field' }, h('label', { for: 'wiz-time' }, 'Preferred time of day'), h('select', { id: 'wiz-time', class: 'input select', onchange: (event: Event) => { input.preferredTime = ((event.target as HTMLSelectElement).value || null) as RequestInput['preferredTime']; } },
          ([['', 'No preference'], ['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']] as const).map(([value, label]) => h('option', { value, selected: (input.preferredTime ?? '') === value }, label)))));
    },
    () => h('div', { class: 'stack', style: { '--stack': '20px' } }, h('h2', { class: 'title' }, 'Your details'), detailsFields(input, errors, { messageLabel: 'Goals or anything the team should know' })),
    () => {
      const p = pack()!, quote = packageQuote(p, trainer(), nutritionist());
      const submit = h('button', { type: 'button', class: 'btn primary' }, 'Send booking request') as HTMLButtonElement;
      submit.addEventListener('click', () => void submitRequest(input, fields => { errors = fields; const target = fields['packageId'] || fields['trainerId'] || fields['nutritionistId'] ? 0 : fields['format'] ? 2 : fields['preferredDates'] ? 3 : 4; step = target; draw(true); focusFirstError(main); }, submit, context.navigate));
      return h('div', { class: 'stack', style: { '--stack': '24px' } }, h('h2', { class: 'title' }, 'Review your request'),
        h('dl', { class: 'review-list' },
          h('div', null, h('dt', null, 'Package'), h('dd', null, `${p.name}, ${p.weeks} weeks`)),
          trainer() ? h('div', null, h('dt', null, 'Trainer'), h('dd', null, trainer()!.name)) : null,
          nutritionist() ? h('div', null, h('dt', null, 'Nutritionist'), h('dd', null, nutritionist()!.name)) : null,
          h('div', null, h('dt', null, 'Format'), h('dd', null, input.format ? FORMAT_LABEL[input.format] : '')),
          input.area ? h('div', null, h('dt', null, 'Area'), h('dd', null, `${input.area}, ${city()?.name ?? ''}`)) : null,
          h('div', null, h('dt', null, 'Preferred dates'), h('dd', null, input.preferredDates.map(date => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })).join(', '))),
          h('div', null, h('dt', null, 'Time of day'), h('dd', null, input.preferredTime ?? 'No preference')),
          h('div', null, h('dt', null, 'Contact'), h('dd', null, `${input.contact.name}, ${input.contact.email}${input.contact.phone ? `, ${input.contact.phone}` : ''}`))),
        quoteBlock(quote),
        notice('This is a booking request, not a confirmed booking. Nothing is reserved or charged until the team confirms with you directly.', 'info'),
        h('div', { class: 'row' }, submit));
    },
  ];

  const summary = () => {
    const p = pack();
    if (!p) return h('p', { class: 'small muted' }, 'Choose a package to see the estimate.');
    const quote = packageQuote(p, trainer(), nutritionist());
    return h('div', { class: 'stack', style: { '--stack': '14px' } }, h('p', { class: 'eyebrow' }, 'Your package'), h('p', { class: 'title' }, p.name),
      h('ul', { class: 'mini-facts', role: 'list' }, p.includes.map(item => h('li', null, item))),
      quote ? quoteBlock(quote) : h('p', { class: 'small muted' }, 'Choose your team to see an estimate.'),
      notice(safetyNote(audience), 'safety'));
  };

  const draw = (moved = false) => {
    replace(progress, STEPS.map((label, index) => h('li', { class: index === step ? 'current' : index < step ? 'done' : '', 'aria-current': index === step ? 'step' : null },
      h('span', { class: 'numeral' }, String(index + 1)), h('span', null, label))), h('li', { class: '' }, h('span', { class: 'numeral' }, '7'), h('span', null, 'Confirmation')));
    replace(main, h('p', { class: 'tag' }, `Step ${step + 1} of 7 · ${STEPS[step]}`), screens[step](),
      step < STEPS.length - 1 ? h('div', { class: 'row wizard-actions' }, button(step ? 'Back' : 'Cancel', back, { variant: 'ghost', icon: 'arrow-left' }), button('Continue', next, { variant: 'primary', iconAfter: 'arrow' }))
        : h('div', { class: 'row wizard-actions' }, button('Back', back, { variant: 'ghost', icon: 'arrow-left' })));
    replace(side, summary());
    if (moved) { live.textContent = `Step ${step + 1} of 7: ${STEPS[step]}`; main.querySelector<HTMLElement>('.tag')?.scrollIntoView({ block: 'nearest' }); (main.querySelector('input, select, button') as HTMLElement | null)?.focus({ preventScroll: true }); }
  };

  const refreshPros = async () => { pros = (await market.professionals({ city: cityId, audience })).results; draw(); };

  const shellBody = h('div', { class: 'wizard' }, progress, h('div', { class: 'wizard-layout' }, main, side), live);
  void load(shellBody, async () => { info = await market.info(); pros = (await market.professionals({ city: cityId, audience })).results; return null; }, () => {
    if (!pack() || !pack()!.audiences.includes(audience)) { step = 0; input.packageId = (info?.packages.find(item => item.audiences.includes(audience))?.id) ?? null; }
    draw();
    return [progress, h('div', { class: 'wizard-layout' }, main, side), live];
  });

  const el = h('div', { class: 'page surface-light booking' }, h('div', { class: 'container' },
    h('a', { class: 'text-link small back-link', href: '#/coaching' }, icon('arrow-left'), 'Personal training'),
    h('header', { class: 'page-head' }, eyebrow('Booking request'), h('h1', { class: 'headline' }, 'Assemble your ', h('em', null, 'team.'))), shellBody));
  return { el, title: 'Booking request', surface: 'light', nav: 'coaching' };
}
