import type { CoachMessage, CoachReply, ProviderId, WorkoutDraft } from '../../shared/coach/contracts.js';
import { LIMITS } from '../../shared/coach/contracts.js';
import { exerciseById, findExercise } from '../../shared/fitness/exercises.js';
import { describeTarget, SPLITS, uid } from '../../shared/fitness/programs.js';
import type { PlanExercise, SplitId } from '../../shared/fitness/types.js';
import { askCoach, CoachError } from '../core/api.js';
import { h, replace } from '../core/dom.js';
import type { View, ViewContext } from '../core/router.js';
import { store, type StoredMessage } from '../core/store.js';
import { mark } from '../ui/brand.js';
import { button, confirmDialog, eyebrow, prose, toast } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { createFromTemplate } from './plans.js';
import { startWorkout } from './shared.js';

const SYMPTOMS = /\b(pain|hurts?|injur|dizz|faint|chest (pain|tight)|numb|short(ness)? of breath|palpitation)/i;
const STARTERS = ['Build me a 45-minute full-body session', 'Recommend a split for my schedule', 'How do I progress my squat?', 'Give me a 20-minute core workout'];

function draftExercises(workout: WorkoutDraft): (PlanExercise & { name: string })[] {
  return workout.exercises.map(item => {
    const known = (item.exerciseId && exerciseById(item.exerciseId)) || findExercise(item.name);
    return { uid: uid('px'), exerciseId: known?.id ?? `custom-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`, name: known?.name ?? item.name,
      sets: item.sets, reps: item.reps, repsMax: item.repsMax, seconds: item.seconds, restSec: item.restSec, note: item.cue.slice(0, 200) };
  });
}

/** What the model sees from earlier turns: the reply plus a one-line record of any suggested workout. */
function toApi(message: StoredMessage): CoachMessage {
  const workout = message.workout as WorkoutDraft | undefined;
  const suffix = workout ? `\n\n[Suggested workout "${workout.title}": ${workout.exercises.map(item => `${item.name} ${describeTarget({ sets: item.sets, reps: item.reps, repsMax: item.repsMax, seconds: item.seconds })}`).join(', ')}]` : '';
  const limit = message.role === 'user' ? LIMITS.userChars : LIMITS.assistantChars;
  return { role: message.role, content: (message.content + suffix).slice(0, limit) };
}

export function coachView(context: ViewContext): View {
  const messages: StoredMessage[] = store.coachMessages();
  let provider: ProviderId = store.provider();
  let pending: AbortController | null = null;
  let error: CoachError | null = null;

  const el = h('div', { class: 'coach surface-dark' });
  const log = h('div', { class: 'coach-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' });
  const input = h('textarea', { class: 'textarea coach-input', rows: 1, maxlength: LIMITS.userChars, placeholder: 'Ask for a workout, a split, a swap or an explanation…', 'aria-label': 'Message the coach' });
  const sendButton = button('', () => send(input.value), { variant: 'primary', icon: 'send', label: 'Send message' });
  const providerHost = h('div', { class: 'provider-host' });

  const persist = () => store.saveCoachMessages(messages.filter(message => !message.error));

  function workoutCard(workout: WorkoutDraft) {
    const exercises = draftExercises(workout);
    const saveToPlan = () => {
      const plan = store.activePlan();
      try {
        if (plan && plan.days.length < 7) {
          const next = structuredClone(plan);
          next.days.push({ id: uid('day'), name: workout.title.slice(0, 60), focus: workout.focus.slice(0, 120), exercises: exercises.filter(item => exerciseById(item.exerciseId)).map(({ name: _name, ...rest }) => rest) });
          store.upsertPlan(next);
          toast(`Added to ${plan.name} as a new session.`, { action: { label: 'Open', run: () => context.navigate(`#/plans/${plan.id}?day=${next.days.length - 1}`) } });
        } else toast(plan ? `${plan.name} already has seven sessions. Remove one first.` : 'Create a plan first, then save sessions to it.', { kind: 'error' });
      } catch (problem) { toast(problem instanceof Error ? problem.message : 'Could not save to the plan.', { kind: 'error' }); }
    };
    return h('section', { class: 'coach-card', 'aria-label': `Suggested workout: ${workout.title}` },
      h('div', { class: 'row between' }, h('div', { class: 'stack', style: { '--stack': '4px' } }, eyebrow('Suggested session'), h('h3', { class: 'title' }, workout.title)), h('span', { class: 'tag' }, `About ${workout.minutes} min`)),
      workout.focus ? h('p', { class: 'muted small' }, workout.focus) : null,
      h('ol', { class: 'coach-exercises', role: 'list' }, workout.exercises.map((item, index) => h('li', null,
        h('span', { class: 'numeral' }, String(index + 1).padStart(2, '0')),
        h('span', { class: 'stack', style: { '--stack': '2px' } }, h('span', { class: 'list-title' }, item.name), item.cue ? h('span', { class: 'list-meta' }, item.cue) : null),
        h('span', { class: 'target tabular' }, describeTarget({ sets: item.sets, reps: item.reps, repsMax: item.repsMax, seconds: item.seconds }))))),
      h('div', { class: 'row' },
        button('Start now', () => startWorkout({ title: workout.title.slice(0, 120), source: 'coach', exercises }, context.navigate), { variant: 'signal', icon: 'play', size: 'small' }),
        button('Save to my plan', saveToPlan, { size: 'small', icon: 'plus' })));
  }

  function splitCard(split: Exclude<SplitId, 'custom'>) {
    const info = SPLITS.find(item => item.id === split);
    if (!info) return null;
    return h('section', { class: 'coach-card' },
      h('div', { class: 'stack', style: { '--stack': '4px' } }, eyebrow('Suggested split'), h('h3', { class: 'title' }, info.name)),
      h('p', { class: 'muted small' }, info.summary),
      button('Create this plan', () => { const plan = createFromTemplate(split, store.profile!.level); store.setActivePlan(plan.id); toast(`${plan.name} created and set as active.`); context.navigate(`#/plans/${plan.id}`); }, { size: 'small', iconAfter: 'arrow' }));
  }

  function drawLog() {
    const items: Node[] = [];
    if (!messages.length) items.push(h('div', { class: 'coach-empty stack', style: { '--stack': '18px' } },
      eyebrow('Your coach'),
      h('h1', { class: 'display' }, 'Ask ', h('em', null, 'anything.')),
      h('p', { class: 'lead' }, 'Sessions for any muscle group, weekly splits, exercise swaps for your equipment, and clear answers about sets, reps, rest and technique.'),
      h('div', { class: 'coach-starters' }, STARTERS.map(text => h('button', { type: 'button', class: 'chip', onclick: () => send(text) }, text)))));
    else items.push(h('h1', { class: 'sr-only' }, 'Coach'));
    const lastUser = [...messages].reverse().find(message => message.role === 'user');
    if (lastUser && SYMPTOMS.test(lastUser.content)) items.push(h('p', { class: 'notice warn' }, icon('alert'), 'If you feel pain, dizziness, chest tightness or shortness of breath, stop exercising. Seek medical help for severe or sudden symptoms.'));
    messages.forEach((message, index) => {
      const last = index === messages.length - 1;
      if (message.role === 'user') { items.push(h('div', { class: 'msg user' }, h('p', { class: 'tag' }, 'You'), h('p', { class: 'msg-text' }, message.content))); return; }
      items.push(h('div', { class: 'msg assistant' },
        h('div', { class: 'msg-who' }, mark(''), h('span', { class: 'tag' }, 'Icarus')),
        h('div', { class: 'msg-body stack', style: { '--stack': '16px' } },
          prose(message.content),
          message.workout ? workoutCard(message.workout as WorkoutDraft) : null,
          message.split ? splitCard(message.split as Exclude<SplitId, 'custom'>) : null,
          last && Array.isArray(message.suggestions) && message.suggestions.length && !pending ? h('div', { class: 'row coach-suggestions' }, (message.suggestions as string[]).map(text => h('button', { type: 'button', class: 'chip', onclick: () => send(text) }, text))) : null)));
    });
    if (pending) items.push(h('div', { class: 'msg assistant pending', 'aria-label': 'The coach is writing' }, h('div', { class: 'msg-who' }, mark(''), h('span', { class: 'tag' }, 'Icarus')),
      h('div', { class: 'row' }, h('span', { class: 'typing', 'aria-hidden': 'true' }, h('span'), h('span'), h('span')), h('span', { class: 'small muted' }, 'Thinking…'), button('Cancel', () => pending?.abort(), { size: 'small', variant: 'ghost' }))));
    if (error && !pending) items.push(h('div', { class: 'notice warn coach-error', role: 'alert' }, icon('alert'), h('div', { class: 'stack', style: { '--stack': '8px' } }, h('p', null, error.message),
      h('div', { class: 'row' }, error.retryable ? button('Try again', retry, { size: 'small' }) : null, provider !== 'offline' ? button('Use Icarus Offline', () => { setProvider('offline'); retry(); }, { size: 'small', variant: 'ghost' }) : null))));
    replace(log, items);
    sendButton.toggleAttribute('disabled', Boolean(pending));
    log.lastElementChild?.scrollIntoView({ block: 'end', behavior: messages.length > 1 ? 'smooth' : 'auto' });
  }

  async function run() {
    const controller = new AbortController();
    pending = controller;
    error = null;
    drawLog();
    const text = messages.at(-1)?.content ?? '';
    const fault = store.config?.testFaults ? (text.startsWith('/fail') ? 'error' : text.startsWith('/slow') ? 'slow' : undefined) : undefined;
    try {
      const result = await askCoach(provider, messages.map(toApi).slice(-LIMITS.messages), controller.signal, fault);
      const reply: CoachReply = result.reply;
      messages.push({ role: 'assistant', content: reply.reply, workout: reply.workout ?? undefined, split: reply.split ?? undefined, suggestions: reply.suggestions });
      persist();
    } catch (problem) {
      error = problem instanceof CoachError ? problem : new CoachError('The coach could not answer.', 'ERROR', true);
      if (error.code === 'CANCELLED') error = null;
    } finally {
      if (pending === controller) pending = null;
      drawLog();
    }
  }

  function send(raw: string) {
    const text = raw.trim();
    if (!text || pending) return;
    if (text.length > LIMITS.userChars) { toast(`Keep messages under ${LIMITS.userChars} characters.`, { kind: 'error' }); return; }
    // Keep the conversation within the server's limit; the oldest turns drop off first.
    while (messages.length >= LIMITS.messages - 1) messages.shift();
    messages.push({ role: 'user', content: text });
    persist();
    input.value = '';
    input.style.height = '';
    void run();
  }
  function retry() { if (messages.at(-1)?.role === 'user') void run(); }

  function setProvider(id: ProviderId) {
    provider = id;
    try { store.savePrefs({ ...store.prefs, provider: id }); } catch { /* preference only */ }
    drawProvider();
  }

  function drawProvider() {
    const providers = store.config?.providers ?? [];
    const selected = providers.find(item => item.id === provider);
    replace(providerHost,
      h('label', { class: 'field' }, h('span', { class: 'label' }, 'Coach'),
        h('select', { class: 'select', disabled: !providers.length, onchange: (event: Event) => setProvider((event.target as HTMLSelectElement).value as ProviderId) },
          providers.length ? providers.map(item => h('option', { value: item.id, selected: item.id === provider, disabled: !item.enabled }, item.enabled ? item.label : `${item.label} (not set up)`)) : h('option', null, 'Server not reachable'))),
      h('p', { class: 'small muted' }, selected ? `${selected.detail}${selected.id !== 'offline' ? ` Model: ${selected.model}.` : ''}` : store.configError || 'Connecting…'),
      providers.some(item => !item.enabled) ? h('a', { class: 'text-link small', href: '#/settings' }, 'How to connect an AI provider') : null);
  }

  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(input.value); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 220)}px`; });

  const profile = store.profile!;
  const plan = store.activePlan();
  replace(el, h('div', { class: 'container coach-layout' },
    h('div', { class: 'coach-main' }, log,
      h('form', { class: 'coach-composer', onsubmit: (event: Event) => { event.preventDefault(); send(input.value); } }, input, sendButton),
      h('p', { class: 'small muted composer-hint' }, 'Enter to send · Shift + Enter for a new line. General fitness guidance, not medical advice.')),
    h('aside', { class: 'coach-rail stack', style: { '--stack': '28px' }, 'aria-label': 'Coach settings and context' },
      providerHost,
      h('div', { class: 'stack', style: { '--stack': '10px' } }, eyebrow('What the coach knows'),
        h('ul', { class: 'context-list', role: 'list' },
          h('li', null, h('span', { class: 'tag' }, 'Goal'), { strength: 'Strength', muscle: 'Build muscle', endurance: 'Endurance', general: 'All-round fitness' }[profile.goal]), h('li', null, h('span', { class: 'tag' }, 'Level'), profile.level),
          h('li', null, h('span', { class: 'tag' }, 'Equipment'), profile.equipment.filter(item => item !== 'bodyweight').join(', ') || 'bodyweight'),
          h('li', null, h('span', { class: 'tag' }, 'Plan'), plan?.name ?? 'none'), h('li', null, h('span', { class: 'tag' }, 'Recent'), `${Math.min(5, store.history.length)} workouts`)),
        h('p', { class: 'small muted' }, 'AI providers receive your messages and this summary, nothing else.')),
      button('New conversation', async () => {
        if (!messages.length) return;
        if (await confirmDialog({ title: 'Start a new conversation?', text: 'The current conversation will be cleared from this device.', confirm: 'Clear', danger: true }) !== true) return;
        pending?.abort(); messages.length = 0; error = null; persist(); drawLog();
      }, { size: 'small', variant: 'ghost', icon: 'plus' }))));
  drawProvider();
  drawLog();
  if (context.query.get('ask')) send(context.query.get('ask')!);
  return { el, title: 'Coach', surface: 'dark', nav: 'coach', cleanup: () => pending?.abort() };
}
