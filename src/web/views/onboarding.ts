import { EQUIPMENT_LABEL } from '../../shared/fitness/exercises.js';
import { recommendedSplit, SPLITS } from '../../shared/fitness/programs.js';
import type { Equipment, Goal, Level, Profile, Units } from '../../shared/fitness/types.js';
import { h, replace } from '../core/dom.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { button, choices, eyebrow, segmented, textField, toast } from '../ui/components.js';
import { icon } from '../ui/icons.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DEFAULT_DAYS: Record<number, number[]> = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
export const GOAL_CHOICES: { value: Goal; title: string; text: string }[] = [
  { value: 'strength', title: 'Get stronger', text: 'Heavier loads, lower reps, longer rest.' },
  { value: 'muscle', title: 'Build muscle', text: 'Moderate loads in the 8–12 rep range.' },
  { value: 'endurance', title: 'Build endurance', text: 'Higher reps, shorter rest, more conditioning.' },
  { value: 'general', title: 'All-round fitness', text: 'A balanced mix of strength and stamina.' },
];
export const LEVEL_CHOICES: { value: Level; title: string; text: string }[] = [
  { value: 'beginner', title: 'Beginner', text: 'New, or returning after a long break. Under six months of consistent training.' },
  { value: 'intermediate', title: 'Intermediate', text: 'Six months to two years of regular training. Comfortable with the main lifts.' },
  { value: 'advanced', title: 'Advanced', text: 'Two years or more. Confident with heavy barbell work and programming.' },
];
export const EQUIPMENT_CHOICES = (Object.keys(EQUIPMENT_LABEL) as Equipment[]).filter(item => item !== 'bodyweight').map(value => ({ value, title: EQUIPMENT_LABEL[value] }));
const PRESETS: { label: string; items: Equipment[] }[] = [
  { label: 'Full gym', items: ['dumbbells', 'barbell', 'kettlebell', 'bench', 'pullup-bar', 'cable', 'machines', 'bands'] },
  { label: 'Home with dumbbells', items: ['dumbbells', 'bench', 'bands'] },
  { label: 'Bodyweight only', items: [] },
];

type Draft = { name: string; goal: Goal | null; level: Level | null; equipment: Equipment[]; daysPerWeek: number; trainingDays: number[]; minutes: number; units: Units };

export function weekdayPicker(selected: number[], onChange: (days: number[]) => void) {
  const set = new Set(selected);
  return h('div', { class: 'field' }, h('p', { class: 'label', id: 'weekday-label' }, 'Preferred days'),
    h('div', { class: 'weekday-picker', role: 'group', 'aria-labelledby': 'weekday-label' }, DAYS.map((day, index) => h('button', {
      type: 'button', class: 'chip weekday', 'aria-pressed': String(set.has(index)),
      onclick: (event: Event) => {
        if (set.has(index)) set.delete(index); else set.add(index);
        (event.currentTarget as HTMLElement).setAttribute('aria-pressed', String(set.has(index)));
        onChange([...set].sort());
      },
    }, day))));
}

export function onboardingView(context: ViewContext): View {
  const existing = store.profile;
  const draft: Draft = existing
    ? { name: existing.name, goal: existing.goal, level: existing.level, equipment: existing.equipment.filter(item => item !== 'bodyweight'), daysPerWeek: existing.daysPerWeek, trainingDays: existing.trainingDays, minutes: existing.minutes, units: existing.units }
    : { name: '', goal: null, level: null, equipment: ['dumbbells', 'bench', 'bands'], daysPerWeek: 3, trainingDays: DEFAULT_DAYS[3], minutes: 45, units: 'kg' };
  let step = 0;
  let error = '';

  const steps: { label: string; title: string; why: string; render: () => HTMLElement; valid: () => string }[] = [
    {
      label: 'Goal', title: 'What are you training for?', why: 'Your goal sets the rep ranges and rest times in every plan Icarus builds for you.',
      valid: () => draft.goal ? '' : 'Choose the goal that fits best. You can change it later.',
      render: () => h('div', { class: 'stack', style: { '--stack': '28px' } },
        textField({ label: 'Your first name (optional)', value: draft.name, maxLength: 40, autocomplete: 'given-name', placeholder: 'For a more personal greeting', onInput: value => { draft.name = value.trim(); } }),
        choices({ legend: 'Primary goal', name: 'goal', items: GOAL_CHOICES, selected: draft.goal ? [draft.goal] : [], onChange: ([value]) => { draft.goal = value; clearError(); } })),
    },
    {
      label: 'Experience', title: 'How experienced are you?', why: 'Experience decides which exercises appear and how many sets you start with. Be honest: starting a little easy is the fastest way to progress.',
      valid: () => draft.level ? '' : 'Choose your experience level.',
      render: () => choices({ legend: 'Training experience', name: 'level', items: LEVEL_CHOICES, selected: draft.level ? [draft.level] : [], onChange: ([value]) => { draft.level = value; clearError(); } }),
    },
    {
      label: 'Equipment', title: 'What can you train with?', why: 'Icarus only suggests exercises you can actually do where you train. Bodyweight exercises are always included.',
      valid: () => '',
      render: () => {
        const holder = h('div');
        const draw = () => replace(holder, choices({ legend: 'Available equipment', name: 'equipment', multiple: true, items: EQUIPMENT_CHOICES, selected: draft.equipment, onChange: values => { draft.equipment = values; }, hint: 'Select everything you have regular access to.' }));
        draw();
        return h('div', { class: 'stack', style: { '--stack': '24px' } },
          h('div', { class: 'row' }, h('span', { class: 'tag' }, 'Quick set'), PRESETS.map(preset => h('button', { type: 'button', class: 'chip', onclick: () => { draft.equipment = [...preset.items]; draw(); } }, preset.label))),
          holder);
      },
    },
    {
      label: 'Schedule', title: 'When do you train?', why: 'Days per week choose your split. Your time limit trims each session so it fits.',
      valid: () => draft.trainingDays.length ? '' : 'Pick at least one day.',
      render: () => {
        const days = h('div');
        const drawDays = () => replace(days, weekdayPicker(draft.trainingDays, value => { draft.trainingDays = value; draft.daysPerWeek = Math.max(1, value.length); clearError(); }));
        drawDays();
        return h('div', { class: 'stack', style: { '--stack': '28px' } },
          segmented({ label: 'Days per week', name: 'days', value: String(draft.daysPerWeek), items: ['2', '3', '4', '5', '6', '7'].map(value => ({ value, label: value })),
            onChange: value => { draft.daysPerWeek = Number(value); draft.trainingDays = DEFAULT_DAYS[draft.daysPerWeek]; drawDays(); } }),
          days,
          segmented({ label: 'Time per session', name: 'minutes', value: String(draft.minutes), items: ['20', '30', '45', '60', '75', '90'].map(value => ({ value, label: `${value} min` })), onChange: value => { draft.minutes = Number(value); } }));
      },
    },
    {
      label: 'Review', title: 'Your programme', why: 'Everything here can be changed later in Settings and the plan builder. Plans are sensible starting points, not guarantees: adjust them to how you feel and recover.',
      valid: () => '',
      render: () => {
        const split = SPLITS.find(item => item.id === recommendedSplit(draft.daysPerWeek, draft.level ?? 'beginner'))!;
        const rows: [string, string][] = [
          ['Goal', GOAL_CHOICES.find(item => item.value === draft.goal)?.title ?? '—'],
          ['Experience', LEVEL_CHOICES.find(item => item.value === draft.level)?.title ?? '—'],
          ['Equipment', draft.equipment.length ? draft.equipment.map(item => EQUIPMENT_LABEL[item]).join(', ') : 'Bodyweight only'],
          ['Schedule', `${draft.trainingDays.map(day => DAYS[day]).join(', ')} · ${draft.minutes} min`],
        ];
        return h('div', { class: 'stack', style: { '--stack': '28px' } },
          segmented({ label: 'Units for weights', name: 'units', value: draft.units, items: [{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }], onChange: value => { draft.units = value as Units; } }),
          h('dl', { class: 'review-list' }, rows.map(([term, value]) => h('div', null, h('dt', null, term), h('dd', null, value)))),
          h('div', { class: 'recommend' }, eyebrow('Recommended split'), h('p', { class: 'title' }, split.name), h('p', { class: 'muted' }, split.summary)));
      },
    },
  ];

  const el = h('section', { class: 'onboarding page surface-light' });
  const clearError = () => { if (error) { error = ''; const node = el.querySelector('.ob-error'); if (node) node.textContent = ''; } };

  const finish = (button: HTMLButtonElement) => {
    button.classList.add('busy');
    const profile: Profile = {
      version: 1, name: draft.name, goal: draft.goal!, level: draft.level!, equipment: ['bodyweight', ...draft.equipment],
      daysPerWeek: draft.trainingDays.length, trainingDays: draft.trainingDays, minutes: draft.minutes, units: draft.units, createdAt: existing?.createdAt ?? Date.now(),
    };
    try {
      store.saveProfile(profile);
      const plan = store.createRecommendedPlan(profile);
      toast(`${plan.name} is ready. You can change anything in Plans.`);
      context.navigate('#/today');
    } catch (problem) {
      button.classList.remove('busy');
      toast(problem instanceof Error ? problem.message : 'Could not save your profile.', { kind: 'error' });
    }
  };

  const draw = (focus = false) => {
    const current = steps[step];
    const next = h('button', { type: 'submit', class: 'btn primary' }, step === steps.length - 1 ? 'Build my programme' : 'Continue', icon('arrow', 'arrow'));
    const form = h('form', { class: 'ob-form stack', style: { '--stack': '32px' }, novalidate: true, onsubmit: (event: Event) => {
      event.preventDefault();
      const problem = current.valid();
      if (problem) { error = problem; const node = form.querySelector('.ob-error'); if (node) node.textContent = problem; (form.querySelector('input') as HTMLElement | null)?.focus(); return; }
      if (step === steps.length - 1) finish(next); else { step++; draw(true); }
    } },
      h('div', { class: 'stack' }, h('p', { class: 'eyebrow' }, `Step ${step + 1} of ${steps.length}`), h('h1', { class: 'headline', tabindex: '-1' }, current.title)),
      current.render(),
      h('p', { class: 'ob-error', role: 'alert' }, error),
      h('div', { class: 'row between ob-actions' },
        step > 0 ? button('Back', () => { step--; error = ''; draw(true); }, { variant: 'ghost', icon: 'arrow-left' }) : h('a', { class: 'btn ghost', href: existing ? '#/settings' : '#/welcome' }, icon('arrow-left'), existing ? 'Cancel' : 'Back'),
        next));
    replace(el, h('div', { class: 'ob-layout' },
      h('aside', { class: 'ob-rail surface-dark', 'aria-label': 'Progress' },
        h('ol', { class: 'ob-steps', role: 'list' }, steps.map((item, index) => h('li', { class: index === step ? 'current' : index < step ? 'done' : '', 'aria-current': index === step ? 'step' : null },
          h('span', { class: 'numeral' }, String(index + 1).padStart(2, '0')), h('span', null, item.label)))),
        h('div', { class: 'ob-why' }, h('p', { class: 'eyebrow' }, 'Why we ask'), h('p', null, current.why)),
        h('div', { class: 'meter', 'aria-hidden': 'true' }, h('span', { style: { width: `${((step + 1) / steps.length) * 100}%` } }))),
      h('div', { class: 'ob-main' }, form)));
    if (focus) (el.querySelector('h1') as HTMLElement | null)?.focus({ preventScroll: true });
  };
  draw();
  return { el, title: 'Set up your programme', surface: 'light', nav: 'onboarding' };
}
