import { exerciseById, MUSCLE_LABEL } from '../../shared/fitness/exercises.js';
import { emptyPlan, estimateMinutes, generatePlan, planExercise, prescribe, SPLITS, uid } from '../../shared/fitness/programs.js';
import type { Level, Plan, PlanDay, PlanExercise, SplitId } from '../../shared/fitness/types.js';
import { debounce, h, replace } from '../core/dom.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { button, confirmDialog, empty, eyebrow, linkButton, segmented, stepper, tabs, toast } from '../ui/components.js';
import { thumb } from '../ui/photo.js';
import { icon } from '../ui/icons.js';
import { pickExercise } from './picker.js';
import { plural, startDay } from './shared.js';

const LEVEL_LABEL: Record<Level, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
const splitName = (split: SplitId) => SPLITS.find(item => item.id === split)?.name ?? 'Custom plan';

export function createFromTemplate(split: Exclude<SplitId, 'custom'>, level: Level): Plan {
  const profile = store.profile!;
  return store.upsertPlan(generatePlan({ split, level, goal: profile.goal, equipment: profile.equipment, minutes: profile.minutes }), !store.plans.length);
}

export function plansView(context: ViewContext): View {
  const profile = store.profile!;
  let level: Level = profile.level;
  const el = h('div', { class: 'page surface-light plans' });

  const draw = () => {
    const active = store.activePlan();
    const remove = async (plan: Plan) => {
      if (await confirmDialog({ title: `Delete ${plan.name}?`, text: 'The plan is removed. Workouts you already logged stay in your history.', confirm: 'Delete plan', danger: true }) !== true) return;
      store.deletePlan(plan.id);
      toast(`${plan.name} deleted.`);
      draw();
    };
    replace(el, h('div', { class: 'container' },
      h('header', { class: 'page-head' }, eyebrow('Programmes'), h('h1', { class: 'display' }, 'Your ', h('em', null, 'plans.')),
        h('p', { class: 'lead' }, 'A plan is a repeating cycle of sessions. Icarus works through it in order and remembers where you are.')),
      h('section', { class: 'stack', style: { '--stack': '16px' }, 'aria-labelledby': 'mine-title' },
        h('div', { class: 'row between' }, h('h2', { class: 'title', id: 'mine-title' }, 'Saved plans'),
          button('Blank plan', () => { const plan = store.upsertPlan(emptyPlan('My plan', profile.level, profile.goal), !store.plans.length); context.navigate(`#/plans/${plan.id}`); }, { size: 'small', icon: 'plus' })),
        store.plans.length ? h('ul', { class: 'plan-list', role: 'list' }, store.plans.map(plan => h('li', { class: `plan-card${plan.id === active?.id ? ' active' : ''}` },
          h('a', { class: 'plan-main', href: `#/plans/${plan.id}` },
            h('span', { class: 'stack', style: { '--stack': '6px' } },
              h('span', { class: 'row' }, h('span', { class: 'title' }, plan.name), plan.id === active?.id ? h('span', { class: 'tag signal' }, h('span', { class: 'dot' }), 'Active') : null),
              h('span', { class: 'list-meta' }, `${splitName(plan.split)} · ${LEVEL_LABEL[plan.level]} · ${plural(plan.days.length, 'session')}`),
              h('span', { class: 'plan-days' }, plan.days.map(day => h('span', { class: 'set-chip' }, day.name)))),
            icon('arrow')),
          h('div', { class: 'row plan-actions' },
            plan.id !== active?.id ? button('Make active', () => { store.setActivePlan(plan.id); toast(`${plan.name} is now your active plan.`); draw(); }, { size: 'small', variant: 'ghost' }) : null,
            button('', () => void remove(plan), { size: 'small', variant: 'ghost', icon: 'trash', label: `Delete ${plan.name}` })))))
          : empty({ title: 'No plans yet', text: 'Start from a template below or build one from scratch.', icon: 'plans' })),
      h('section', { class: 'section-tight stack', style: { '--stack': '20px' }, 'aria-labelledby': 'templates-title' },
        h('div', { class: 'row between' }, h('div', { class: 'stack', style: { '--stack': '6px' } }, h('h2', { class: 'title', id: 'templates-title' }, 'Start from a template'),
          h('p', { class: 'muted small' }, `Filled with exercises for your equipment and ${profile.minutes}-minute sessions. Sensible defaults, not a guarantee: adjust anything.`)),
        segmented({ label: 'Build for', name: 'template-level', value: level, items: (['beginner', 'intermediate', 'advanced'] as Level[]).map(value => ({ value, label: LEVEL_LABEL[value] })), onChange: value => { level = value; } })),
        h('ul', { class: 'template-grid', role: 'list' }, SPLITS.map(split => h('li', { class: 'template' },
          h('p', { class: 'numeral template-days' }, String(split.days), h('small', null, split.days === 1 ? 'day' : 'days')),
          h('h3', { class: 'title' }, split.name.split(' · ')[0]),
          h('p', { class: 'muted small' }, split.summary),
          button('Create', () => { const plan = createFromTemplate(split.id, level); toast(`${plan.name} created.`); context.navigate(`#/plans/${plan.id}`); }, { size: 'small', iconAfter: 'arrow' })))))));
  };
  draw();
  return { el, title: 'Plans', surface: 'light', nav: 'plans' };
}

export function planEditorView(context: ViewContext): View {
  const original = store.plans.find(plan => plan.id === context.params.id);
  if (!original) return { el: h('div', { class: 'page surface-light' }, h('div', { class: 'container section' }, empty({ title: 'Plan not found', text: 'It may have been deleted in another tab.', action: linkButton('All plans', '#/plans', { variant: 'primary' }) }))), title: 'Plan not found', surface: 'light', nav: 'plans' };
  const draft: Plan = structuredClone(original);
  let dayIndex = Math.min(Number(context.query.get('day') ?? 0) || 0, draft.days.length - 1);
  const el = h('div', { class: 'page surface-light editor' });
  const status = h('p', { class: 'tag save-status', role: 'status' }, 'All changes saved');
  const estimate = h('span', { class: 'tag' });

  const save = () => {
    try {
      store.upsertPlan(draft);
      status.textContent = 'All changes saved';
    } catch (error) {
      status.textContent = 'Not saved';
      toast(error instanceof Error ? error.message : 'Could not save the plan.', { kind: 'error' });
    }
  };
  const saveSoon = debounce(save, 350);
  const changed = (structural = false) => {
    status.textContent = 'Saving…';
    estimate.textContent = `About ${estimateMinutes(draft.days[dayIndex].exercises)} min`;
    if (structural) { save(); drawDay(); } else saveSoon();
  };

  const dayHost = h('div');
  const tabsHost = h('div', { class: 'row day-tabs' });

  function exerciseItem(item: PlanExercise, index: number, list: PlanExercise[]) {
    const exercise = exerciseById(item.exerciseId);
    const move = (offset: number) => {
      const target = index + offset;
      if (target < 0 || target >= list.length) return;
      [list[index], list[target]] = [list[target], list[index]];
      changed(true);
      (dayHost.querySelectorAll<HTMLElement>('.move-up, .move-down')[target * 2 + (offset > 0 ? 1 : 0)])?.focus();
    };
    const timed = exercise?.kind === 'time' || item.seconds !== null;
    const name = exercise?.name ?? item.exerciseId;
    const li = h('li', { class: 'editor-row', draggable: 'true', dataset: { index: String(index) } },
      h('div', { class: 'reorder' },
        h('span', { class: 'grip', 'aria-hidden': 'true' }, icon('grip')),
        h('button', { type: 'button', class: 'btn ghost icon small move-up', 'aria-label': `Move ${name} up`, disabled: index === 0, onclick: () => move(-1) }, icon('up')),
        h('button', { type: 'button', class: 'btn ghost icon small move-down', 'aria-label': `Move ${name} down`, disabled: index === list.length - 1, onclick: () => move(1) }, icon('down-small'))),
      h('a', { class: 'editor-ex', href: `#/library/${item.exerciseId}` },
        thumb(item.exerciseId),
        h('span', { class: 'stack', style: { '--stack': '2px' } }, h('span', { class: 'list-title' }, name), h('span', { class: 'list-meta' }, exercise?.primary.map(muscle => MUSCLE_LABEL[muscle]).join(' · ') ?? ''))),
      h('div', { class: 'editor-fields' },
        h('label', { class: 'mini-field' }, h('span', null, 'Sets'), stepper({ label: `Sets for ${name}`, compact: true, value: item.sets, min: 1, max: 10, onChange: value => { item.sets = value ?? 1; changed(); } })),
        timed
          ? h('label', { class: 'mini-field' }, h('span', null, 'Seconds'), stepper({ label: `Seconds for ${name}`, compact: true, value: item.seconds ?? 30, min: 5, max: 3600, step: 5, onChange: value => { item.seconds = value ?? 30; item.reps = null; item.repsMax = null; changed(); } }))
          : [
            h('label', { class: 'mini-field' }, h('span', null, 'Reps'), stepper({ label: `Reps for ${name}`, compact: true, value: item.reps ?? 10, min: 1, max: 100, onChange: value => { item.reps = value ?? 1; if (item.repsMax !== null && item.repsMax < item.reps) item.repsMax = item.reps; changed(); } })),
            h('label', { class: 'mini-field' }, h('span', null, 'Up to'), stepper({ label: `Top of rep range for ${name} (optional)`, compact: true, allowEmpty: true, value: item.repsMax, min: 1, max: 100, onChange: value => { item.repsMax = value === null ? null : Math.max(value, item.reps ?? 1); changed(); } })),
          ],
        h('label', { class: 'mini-field' }, h('span', null, 'Rest (s)'), stepper({ label: `Rest seconds for ${name}`, compact: true, value: item.restSec, min: 0, max: 600, step: 15, onChange: value => { item.restSec = value ?? 0; changed(); } }))),
      h('input', { class: 'input note-input', type: 'text', maxlength: 200, placeholder: 'Note (optional): tempo, setup, cues…', value: item.note, 'aria-label': `Note for ${name}`, oninput: (event: Event) => { item.note = (event.target as HTMLInputElement).value; changed(); } }),
      h('div', { class: 'row row-actions' },
        button('Replace', async () => {
          const choice = await pickExercise({ title: `Replace ${name}`, replacing: item.exerciseId });
          if (!choice) return;
          const fresh = planExercise(choice, prescribe(choice, exerciseById(item.exerciseId)?.compound ? 'main' : 'accessory', draft.level, draft.goal));
          list[index] = { ...fresh, sets: item.sets, restSec: item.restSec, note: item.note, ...(choice.kind === (exercise?.kind ?? 'reps') ? { reps: fresh.reps === null ? null : item.reps ?? fresh.reps, repsMax: fresh.repsMax === null ? null : item.repsMax, seconds: fresh.seconds === null ? null : item.seconds ?? fresh.seconds } : {}) };
          changed(true);
          toast(`Replaced with ${choice.name}.`);
        }, { size: 'small', variant: 'ghost', icon: 'swap' }),
        button('Remove', () => { list.splice(index, 1); changed(true); toast(`${name} removed.`, { action: { label: 'Undo', run: () => { list.splice(index, 0, item); changed(true); } } }); }, { size: 'small', variant: 'ghost', icon: 'trash' })));
    // Mouse drag to reorder; keyboard users have the arrow buttons.
    li.addEventListener('dragstart', event => { event.dataTransfer?.setData('text/plain', String(index)); li.classList.add('dragging'); });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    li.addEventListener('dragover', event => { event.preventDefault(); li.classList.add('drop-target'); });
    li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
    li.addEventListener('drop', event => {
      event.preventDefault();
      const from = Number(event.dataTransfer?.getData('text/plain'));
      if (Number.isNaN(from) || from === index) return;
      const [moved] = list.splice(from, 1);
      list.splice(index, 0, moved);
      changed(true);
    });
    return li;
  }

  function drawTabs() {
    replace(tabsHost,
      tabs({ label: 'Plan days', value: String(dayIndex), items: draft.days.map((day, index) => ({ value: String(index), label: day.name || `Day ${index + 1}` })), onChange: value => { dayIndex = Number(value); drawTabs(); drawDay(); } }),
      draft.days.length < 7 ? button('Add day', () => {
        draft.days.push({ id: uid('day'), name: `Day ${draft.days.length + 1}`, focus: '', exercises: [] });
        dayIndex = draft.days.length - 1;
        changed(true); drawTabs();
      }, { size: 'small', variant: 'ghost', icon: 'plus' }) : null);
  }

  function drawDay() {
    const day: PlanDay = draft.days[dayIndex];
    estimate.textContent = `About ${estimateMinutes(day.exercises)} min`;
    replace(dayHost, h('section', { class: 'day-panel', 'aria-label': day.name },
      h('div', { class: 'day-fields' },
        h('label', { class: 'field' }, h('span', { class: 'label' }, 'Session name'), h('input', { class: 'input', value: day.name, maxlength: 60, oninput: (event: Event) => { day.name = (event.target as HTMLInputElement).value.slice(0, 60) || `Day ${dayIndex + 1}`; changed(); }, onchange: () => drawTabs() })),
        h('label', { class: 'field' }, h('span', { class: 'label' }, 'Focus'), h('input', { class: 'input', value: day.focus, maxlength: 120, placeholder: 'e.g. Chest, shoulders and triceps', oninput: (event: Event) => { day.focus = (event.target as HTMLInputElement).value.slice(0, 120); changed(); } }))),
      h('div', { class: 'row between day-bar' },
        h('div', { class: 'row' }, estimate, h('span', { class: 'tag' }, plural(day.exercises.length, 'exercise'))),
        h('div', { class: 'row' },
          button('Start this session', () => { save(); startDay(draft, day, context.navigate); }, { size: 'small', variant: 'primary', icon: 'play', attrs: { disabled: !day.exercises.length } }),
          draft.days.length > 1 ? button('Remove day', async () => {
            if (await confirmDialog({ title: `Remove ${day.name}?`, text: `${day.name} and its ${plural(day.exercises.length, 'exercise')} will be removed from this plan.`, confirm: 'Remove day', danger: true }) !== true) return;
            draft.days.splice(dayIndex, 1);
            dayIndex = Math.max(0, dayIndex - 1);
            changed(true); drawTabs();
          }, { size: 'small', variant: 'ghost', icon: 'trash' }) : null)),
      day.exercises.length
        ? h('ol', { class: 'editor-list', role: 'list' }, day.exercises.map((item, index) => exerciseItem(item, index, day.exercises)))
        : empty({ title: 'An empty session', text: 'Add exercises from the library. Icarus fills in sets, reps and rest for your level.', icon: 'dumbbell' }),
      button('Add exercise', async () => {
        if (day.exercises.length >= 30) { toast('A session can hold up to 30 exercises.', { kind: 'error' }); return; }
        const choice = await pickExercise({ title: `Add to ${day.name}` });
        if (!choice) return;
        day.exercises.push(planExercise(choice, prescribe(choice, choice.compound ? 'main' : choice.primary.includes('core') ? 'core' : 'accessory', draft.level, draft.goal)));
        changed(true);
        toast(`${choice.name} added.`);
      }, { icon: 'plus', block: true })));
  }

  const isActive = () => store.activePlanId === draft.id;
  const activeHost = h('span');
  const drawActive = () => replace(activeHost, isActive() ? h('span', { class: 'tag signal' }, h('span', { class: 'dot' }), 'Active plan') : button('Make active', () => { store.setActivePlan(draft.id); drawActive(); toast(`${draft.name} is now your active plan.`); }, { size: 'small' }));
  drawActive();

  replace(el, h('div', { class: 'container' },
    h('header', { class: 'page-head' },
      h('a', { class: 'text-link small back-link', href: '#/plans' }, icon('arrow-left'), 'All plans'),
      h('label', { class: 'sr-only', for: 'plan-name' }, 'Plan name'),
      h('h1', { class: 'sr-only' }, `Edit ${draft.name}`),
      h('input', { id: 'plan-name', class: 'plan-name display', value: draft.name, maxlength: 80, oninput: (event: Event) => { draft.name = (event.target as HTMLInputElement).value.slice(0, 80) || 'Untitled plan'; changed(); } }),
      h('div', { class: 'row between' },
        h('div', { class: 'row' }, h('span', { class: 'tag' }, splitName(draft.split)), h('span', { class: 'tag' }, LEVEL_LABEL[draft.level]), activeHost),
        h('div', { class: 'row' }, status,
          button('Delete plan', async () => {
            if (await confirmDialog({ title: `Delete ${draft.name}?`, text: 'Workouts you already logged stay in your history.', confirm: 'Delete plan', danger: true }) !== true) return;
            store.deletePlan(draft.id); toast('Plan deleted.'); context.navigate('#/plans');
          }, { size: 'small', variant: 'ghost', icon: 'trash' })))),
    tabsHost, dayHost,
    h('p', { class: 'small muted section-tight' }, 'Changes save automatically to this browser.')));
  drawTabs();
  drawDay();
  return { el, title: `Edit ${draft.name}`, surface: 'light', nav: 'plans' };
}
