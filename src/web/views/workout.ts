import { exerciseById, MUSCLE_LABEL } from '../../shared/fitness/exercises.js';
import { addSet, adjustRest, cancelHold, completeSet, elapsedMs, goTo, isComplete, nextOpenSet, pause, progress, remainingMs, removeSet, resume, skipRest, startHold, undoSet, updateSet } from '../../shared/fitness/session.js';
import { formatClock, formatLoad, fromDisplay, lastPerformance, toDisplay } from '../../shared/fitness/stats.js';
import type { ActiveSession, SessionExercise } from '../../shared/fitness/types.js';
import { h, replace } from '../core/dom.js';
import { cue, primeAudio } from '../core/feedback.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { button, confirmDialog, ring, stepper, toast } from '../ui/components.js';
import { demo } from '../ui/photo.js';
import { icon } from '../ui/icons.js';
import { plural, relativeDay } from './shared.js';

const target = (exercise: SessionExercise) => exercise.kind === 'time'
  ? `${exercise.sets.length} × ${exercise.targetSeconds ?? 30}s`
  : `${exercise.sets.length} × ${exercise.targetReps ?? '—'}${exercise.targetRepsMax && exercise.targetRepsMax !== exercise.targetReps ? `–${exercise.targetRepsMax}` : ''}`;

export function workoutView(context: ViewContext): View | string {
  if (!store.session) return '#/today';
  const units = store.profile?.units ?? 'kg';
  const el = h('div', { class: 'workout surface-dark' });
  const live = h('p', { class: 'sr-only', 'aria-live': 'assertive' });
  const tickers: (() => void)[] = [];
  let key = '';
  let lastCountdown = 0;
  let wakeLock: { release: () => Promise<void> } | null = null;

  const announce = (text: string) => { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); };
  const apply = (change: (session: ActiveSession) => ActiveSession) => {
    try { store.updateSession(change); }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not save that change.', { kind: 'error' }); }
  };
  const session = () => store.session!;

  // ── Actions ────────────────────────────────────────────────────────────────
  const logSet = (exerciseIndex: number, setIndex: number) => {
    primeAudio();
    const exercise = session().exercises[exerciseIndex];
    const set = exercise.sets[setIndex];
    if (exercise.kind === 'reps' && (set.reps === null || set.reps < 1)) { toast('Enter the reps you completed first.', { kind: 'error' }); return; }
    apply(current => completeSet(current, exerciseIndex, setIndex, {}, Date.now(), store.prefs.autoRest));
    const now = session();
    announce(`Set ${setIndex + 1} of ${exercise.name} logged.${now.rest ? ` Rest ${now.rest.durationSec} seconds.` : ''}${isComplete(now) ? ' Every set is done.' : ''}`);
  };
  const finishWorkout = () => {
    primeAudio();
    const workout = store.finishWorkout();
    if (!workout) { toast('Nothing was logged, so the session was not saved.'); context.navigate('#/today'); return; }
    cue('finish');
    context.navigate(`#/summary/${workout.id}`);
  };
  const endWorkout = async () => {
    const current = session();
    const left = progress(current);
    if (left.done === left.total) { finishWorkout(); return; }
    const choice = await confirmDialog({
      title: 'End this workout?',
      text: left.done ? `${plural(left.total - left.done, 'set')} not logged yet. Save what you have done, or discard the whole session.` : 'No sets are logged yet. Discard this session?',
      confirm: left.done ? 'Save and finish' : 'Keep training', cancel: left.done ? 'Keep training' : 'Cancel',
      extra: { label: 'Discard', value: 'discard' },
    });
    if (choice === 'discard') {
      const sure = await confirmDialog({ title: 'Discard workout?', text: 'Logged sets from this session will be lost. This cannot be undone.', confirm: 'Discard workout', danger: true });
      if (sure === true) { store.discardWorkout(); toast('Workout discarded.'); context.navigate('#/today'); }
    } else if (choice === true && left.done) finishWorkout();
  };
  const togglePause = () => {
    const now = Date.now();
    apply(current => current.pausedAt ? resume(current, now) : pause(current, now));
    announce(session().pausedAt ? 'Workout paused.' : 'Workout resumed.');
  };

  // ── Rendering ──────────────────────────────────────────────────────────────
  const structureKey = (current: ActiveSession) => JSON.stringify([current.index, current.pausedAt !== null, current.rest?.setIndex ?? -1, current.rest?.exerciseIndex ?? -1, current.hold?.setIndex ?? -1,
    current.exercises.map(exercise => exercise.sets.map(set => set.done ? 1 : 0).join('')), store.prefs.autoRest]);

  function setRow(exercise: SessionExercise, exerciseIndex: number, setIndex: number, open: number) {
    const set = exercise.sets[setIndex];
    const isCurrent = setIndex === open;
    const label = `set ${setIndex + 1}`;
    const cells: (Node | null)[] = [h('span', { class: 'set-number numeral', 'aria-hidden': 'true' }, String(setIndex + 1))];
    if (set.done) {
      cells.push(h('span', { class: 'set-values' },
        exercise.loaded && set.loadKg !== null ? h('span', null, formatLoad(set.loadKg, units)) : null,
        h('span', null, exercise.kind === 'time' ? `${set.seconds ?? exercise.targetSeconds}s` : exercise.loaded && set.loadKg !== null ? `× ${set.reps ?? 0}` : `${set.reps ?? 0} reps`)));
      cells.push(h('button', { type: 'button', class: 'set-check done', 'aria-label': `Undo ${label}`, onclick: () => { apply(current => undoSet(current, exerciseIndex, setIndex)); announce(`Set ${setIndex + 1} reopened.`); } }, icon('check')));
    } else {
      const inputs = h('span', { class: 'set-inputs' });
      if (exercise.loaded) inputs.append(stepper({ label: `Load for ${label} in ${units}`, placeholder: units, compact: true, allowEmpty: true, value: set.loadKg === null ? null : toDisplay(set.loadKg, units), min: 0, max: units === 'kg' ? 500 : 1100, step: units === 'kg' ? 2.5 : 5,
        onChange: value => apply(current => updateSet(current, exerciseIndex, setIndex, { loadKg: value === null ? null : fromDisplay(value, units) })) }));
      if (exercise.kind === 'time') inputs.append(stepper({ label: `Seconds for ${label}`, compact: true, value: set.seconds ?? exercise.targetSeconds ?? 30, min: 5, max: 3600, step: 5,
        onChange: value => apply(current => updateSet(current, exerciseIndex, setIndex, { seconds: value })) }));
      else inputs.append(stepper({ label: `Reps for ${label}`, compact: true, value: set.reps, min: 0, max: 200, allowEmpty: true,
        onChange: value => apply(current => updateSet(current, exerciseIndex, setIndex, { reps: value })) }));
      cells.push(inputs);
      cells.push(exercise.kind === 'time'
        ? h('button', { type: 'button', class: `set-check${isCurrent ? ' current' : ''}`, 'aria-label': `Start hold for ${label}`, onclick: () => { primeAudio(); apply(current => startHold(current, exerciseIndex, setIndex, Date.now())); announce(`Hold started.`); } }, icon('play'))
        : h('button', { type: 'button', class: `set-check${isCurrent ? ' current' : ''}`, 'aria-label': `Log ${label}`, onclick: () => logSet(exerciseIndex, setIndex) }, icon('check')));
    }
    return h('li', { class: `set-row${set.done ? ' done' : ''}${isCurrent ? ' current' : ''}` }, cells);
  }

  function countdownPanel(kind: 'rest' | 'hold', current: ActiveSession) {
    const countdown = kind === 'rest' ? current.rest! : current.hold!;
    const next = current.exercises[countdown.exerciseIndex];
    const dial = ring(220, 3);
    const time = h('p', { class: 'numeral countdown-time', role: 'timer', 'aria-label': kind === 'rest' ? 'Rest remaining' : 'Hold remaining' });
    const update = () => {
      const left = remainingMs(store.session?.[kind] ?? null, Date.now());
      const total = countdown.durationSec * 1000;
      dial.update(total ? left / total : 0);
      time.textContent = formatClock(left);
      const seconds = Math.ceil(left / 1000);
      if (seconds <= 3 && seconds >= 1 && seconds !== lastCountdown && !current.pausedAt && document.visibilityState === 'visible') { lastCountdown = seconds; cue('countdown'); }
    };
    update();
    tickers.push(update);
    return h('section', { class: `countdown ${kind}`, 'aria-label': kind === 'rest' ? 'Rest timer' : 'Hold timer' },
      h('div', { class: 'ring countdown-ring' }, dial.svg, h('div', { class: 'ring-center' }, h('p', { class: 'eyebrow' }, kind === 'rest' ? 'Rest' : 'Hold'), time)),
      h('p', { class: 'countdown-next small' }, kind === 'rest' ? `Next: set ${countdown.setIndex + 1} of ${next.sets.length} · ${next.name}` : `${next.name} · set ${countdown.setIndex + 1}`),
      kind === 'rest'
        ? h('div', { class: 'row countdown-actions' },
          button('−15s', () => apply(value => adjustRest(value, -15, Date.now())), { size: 'small', attrs: { 'aria-label': 'Shorten rest by 15 seconds' } }),
          button('+15s', () => apply(value => adjustRest(value, 15, Date.now())), { size: 'small', attrs: { 'aria-label': 'Extend rest by 15 seconds' } }),
          button('Skip rest', () => { apply(skipRest); announce('Rest skipped.'); }, { size: 'small', variant: 'primary', icon: 'skip' }))
        : h('div', { class: 'row countdown-actions' },
          button('Cancel hold', () => apply(cancelHold), { size: 'small' }),
          button('Log now', () => { const hold = session().hold!; const done = Math.max(1, Math.round(hold.durationSec - remainingMs(hold, Date.now()) / 1000)); apply(value => completeSet(value, hold.exerciseIndex, hold.setIndex, { seconds: done }, Date.now(), store.prefs.autoRest)); }, { size: 'small', variant: 'primary', icon: 'check' })));
  }

  function render() {
    const current = store.session;
    if (!current) return;
    key = structureKey(current);
    tickers.length = 0;
    const exercise = current.exercises[current.index];
    const info = exerciseById(exercise.exerciseId);
    const open = exercise.sets.findIndex(set => !set.done);
    const stats = progress(current);
    const complete = isComplete(current);
    const previous = lastPerformance(store.history, exercise.exerciseId);
    const elapsed = h('span', { class: 'numeral elapsed', 'aria-label': 'Elapsed time' });
    tickers.push(() => { elapsed.textContent = formatClock(elapsedMs(store.session!, Date.now())); });

    const topbar = h('header', { class: 'workout-bar' },
      h('div', { class: 'container workout-bar-inner' },
        button(h('span', { class: 'hide-narrow' }, 'End workout'), () => void endWorkout(), { variant: 'ghost', size: 'small', icon: 'close', label: 'End workout' }),
        h('div', { class: 'workout-title' }, h('p', { class: 'tag' }, current.title), elapsed),
        h('div', { class: 'row' },
          button(h('span', { class: 'hide-narrow' }, current.pausedAt ? 'Resume' : 'Pause'), togglePause, { size: 'small', icon: current.pausedAt ? 'play' : 'pause', label: current.pausedAt ? 'Resume workout' : 'Pause workout', attrs: { 'aria-keyshortcuts': 'P' } }),
          h('a', { class: 'btn ghost icon small', href: '#/today', 'aria-label': 'Leave the workout screen (the session keeps running)' }, icon('down-small')))),
      h('div', { class: 'meter workout-meter', role: 'progressbar', 'aria-label': 'Sets logged', 'aria-valuemin': '0', 'aria-valuemax': String(stats.total), 'aria-valuenow': String(stats.done) }, h('span', { style: { width: `${stats.ratio * 100}%` } })));

    const strip = h('ol', { class: 'exercise-strip', role: 'list', 'aria-label': 'Exercises' }, current.exercises.map((item, index) => {
      const done = item.sets.every(set => set.done), started = item.sets.some(set => set.done);
      return h('li', null, h('button', { type: 'button', class: `strip-item${index === current.index ? ' active' : ''}${done ? ' done' : started ? ' started' : ''}`, 'aria-current': index === current.index ? 'step' : null,
        onclick: () => apply(value => goTo(value, index)) },
        h('span', { class: 'numeral' }, String(index + 1).padStart(2, '0')), h('span', { class: 'strip-name' }, item.name), done ? icon('check') : null));
    }));

    const stage = h('section', { class: 'stage', 'aria-labelledby': 'exercise-title' },
      h('div', { class: 'stage-copy stack', style: { '--stack': '14px' } },
        h('p', { class: 'eyebrow' }, `Exercise ${current.index + 1} of ${current.exercises.length}`),
        h('h1', { class: 'display', id: 'exercise-title' }, exercise.name),
        h('p', { class: 'stage-target' }, h('span', { class: 'numeral' }, target(exercise)), h('span', { class: 'tag' }, `Rest ${formatClock(exercise.restSec * 1000)}`)),
        info ? h('p', { class: 'muscles' }, info.primary.map(muscle => h('span', { class: 'tag accent' }, MUSCLE_LABEL[muscle]))) : null,
        previous ? h('p', { class: 'small muted' }, `Last time (${relativeDay(previous.at).toLowerCase()}): ${previous.sets.map(set => exercise.kind === 'time' ? `${set.seconds ?? 0}s` : `${set.reps ?? 0}${set.loadKg ? ` @ ${formatLoad(set.loadKg, units)}` : ''}`).join(', ')}`) : null,
        exercise.note ? h('p', { class: 'notice' }, icon('info'), exercise.note) : null),
      h('div', { class: 'stage-figure' }, demo(exercise.exerciseId, { title: exercise.name })),
      info ? h('details', { class: 'technique', open: current.index === 0 && stats.done === 0 },
        h('summary', null, h('span', { class: 'eyebrow' }, 'Technique'), icon('down-small')),
        h('div', { class: 'technique-body' },
          h('div', null, h('p', { class: 'tag' }, 'Cues'), h('ol', { role: 'list' }, info.cues.map((text, index) => h('li', null, h('span', { class: 'numeral' }, String(index + 1)), text)))),
          h('div', null, h('p', { class: 'tag signal' }, 'Avoid'), h('ul', { role: 'list' }, info.mistakes.map(text => h('li', null, icon('close'), text)))))) : null);

    const timerPanel = current.hold ? countdownPanel('hold', current) : current.rest ? countdownPanel('rest', current) : null;
    const nextOpen = nextOpenSet(current);
    const controls = h('section', { class: 'controls', 'aria-label': 'Sets' },
      timerPanel,
      h('div', { class: 'sets-head' }, h('h2', { class: 'tag' }, 'Set'),
        h('span', { class: 'set-inputs' }, exercise.loaded ? h('span', { class: 'tag' }, `Load · ${units}`) : null, h('span', { class: 'tag' }, exercise.kind === 'time' ? 'Seconds' : 'Reps')), h('span')),
      h('ol', { class: 'set-list', role: 'list' }, exercise.sets.map((_, index) => setRow(exercise, current.index, index, open))),
      h('div', { class: 'row set-tools' },
        button('Add set', () => apply(value => addSet(value, current.index)), { size: 'small', variant: 'ghost', icon: 'plus' }),
        exercise.sets.some(set => !set.done) && exercise.sets.length > 1 ? button('Remove set', () => apply(value => removeSet(value, current.index)), { size: 'small', variant: 'ghost', icon: 'minus' }) : null),
      complete
        ? h('div', { class: 'finish-callout' }, h('p', { class: 'title' }, 'Every set is logged.'), button('Finish workout', finishWorkout, { variant: 'signal', iconAfter: 'arrow', block: true }))
        : h('div', { class: 'exercise-nav' },
          button('Previous', () => apply(value => goTo(value, current.index - 1)), { variant: 'ghost', icon: 'chevron-left', attrs: { disabled: current.index === 0 } }),
          open < 0 && nextOpen
            ? button(`Next: ${current.exercises[nextOpen.exerciseIndex].name}`, () => apply(value => goTo(value, nextOpen.exerciseIndex)), { variant: 'primary', iconAfter: 'arrow' })
            : button('Next exercise', () => apply(value => goTo(value, current.index + 1)), { variant: 'ghost', iconAfter: 'chevron', attrs: { disabled: current.index === current.exercises.length - 1 } })),
      h('p', { class: 'shortcuts small muted' }, 'Keyboard: Space logs the current set · S skips rest · P pauses · ← → change exercise'));

    const paused = current.pausedAt ? h('div', { class: 'paused-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'paused-title' },
      h('div', { class: 'stack', style: { '--stack': '20px' } }, h('p', { class: 'eyebrow' }, 'Session paused'), h('h2', { class: 'display', id: 'paused-title' }, 'Take your ', h('em', null, 'time.')),
        h('p', { class: 'lead' }, 'The clock and any rest timer are frozen. Your progress is saved.'),
        h('div', { class: 'row' }, button('Resume', togglePause, { variant: 'primary', icon: 'play' }), button('End workout', () => void endWorkout(), { variant: 'ghost' })))) : null;

    replace(el, topbar, h('div', { class: 'container workout-body' }, h('div', { class: 'workout-grid' }, stage, controls), strip), paused, live);
    if (paused) (paused.querySelector('button') as HTMLElement | null)?.focus();
    for (const fn of tickers) fn();
  }

  const unsubscribe = store.subscribe(() => {
    if (!store.session) { context.navigate('#/today'); return; }
    if (structureKey(store.session) !== key) render();
  });
  const interval = setInterval(() => {
    const events = store.settleSession();
    if (events.length) { cue(events.includes('hold-done') ? 'hold-done' : 'rest-done'); announce(events.includes('hold-done') ? 'Hold complete. Set logged.' : 'Rest over. Next set.'); lastCountdown = 0; }
    for (const fn of tickers) fn();
  }, 250);

  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, dialog') || event.metaKey || event.ctrlKey || event.altKey) return;
    const current = store.session;
    if (!current) return;
    if (event.key === ' ' && !target.closest('button, a, summary')) {
      event.preventDefault();
      const open = nextOpenSet(current, current.index);
      if (open && open.exerciseIndex === current.index && current.exercises[current.index].kind === 'reps') logSet(open.exerciseIndex, open.setIndex);
    } else if (event.key.toLowerCase() === 's' && current.rest) apply(skipRest);
    else if (event.key.toLowerCase() === 'p') togglePause();
    else if (event.key === 'ArrowRight') apply(value => goTo(value, value.index + 1));
    else if (event.key === 'ArrowLeft') apply(value => goTo(value, value.index - 1));
  };
  document.addEventListener('keydown', onKey);

  // Keep the screen awake during a workout where the browser allows it.
  const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
  const requestWake = () => { if (nav.wakeLock && document.visibilityState === 'visible') nav.wakeLock.request('screen').then(lock => { wakeLock = lock; }).catch(() => { /* not allowed */ }); };
  requestWake();
  document.addEventListener('visibilitychange', requestWake);

  render();
  return {
    el, title: store.session.title, surface: 'dark', immersive: true, nav: 'workout',
    cleanup: () => { unsubscribe(); clearInterval(interval); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', requestWake); void wakeLock?.release().catch(() => {}); },
  };
}
