import type { Equipment, Goal, Level, Profile, Units } from '../../shared/fitness/types.js';
import { h, replace } from '../core/dom.js';
import type { View, ViewContext } from '../core/router.js';
import { store } from '../core/store.js';
import { button, choices, confirmDialog, eyebrow, segmented, switchRow, textField, toast } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { DEFAULT_DAYS, EQUIPMENT_CHOICES, GOAL_CHOICES, LEVEL_CHOICES, weekdayPicker } from './onboarding.js';

const SETUP: Record<string, string> = {
  'anthropic-api': 'ANTHROPIC_API_KEY=your-key\n# optional: ANTHROPIC_MODEL=claude-opus-5-5',
  'openai-api': 'OPENAI_API_KEY=your-key\n# optional: OPENAI_MODEL=gpt-6-astra',
  'claude-cli': 'CLAUDE_CLI_PATH=/absolute/path/to/claude\n# then run `claude` once and sign in',
  'codex-cli': 'CODEX_CLI_PATH=/absolute/path/to/codex\n# then run `codex login`',
};

export function settingsView(context: ViewContext): View {
  const el = h('div', { class: 'page surface-light settings' });

  function section(id: string, title: string, intro: string, ...content: (Node | null)[]) {
    return h('section', { class: 'settings-section', 'aria-labelledby': id },
      h('div', { class: 'settings-label stack', style: { '--stack': '8px' } }, h('h2', { class: 'title', id }, title), h('p', { class: 'small muted' }, intro)),
      h('div', { class: 'settings-content stack', style: { '--stack': '24px' } }, ...content));
  }

  function profileSection() {
    const profile = store.profile!;
    const draft = { ...profile, equipment: profile.equipment.filter(item => item !== 'bodyweight') } as Omit<Profile, 'equipment'> & { equipment: Equipment[] };
    const days = h('div');
    const drawDays = () => replace(days, weekdayPicker(draft.trainingDays, value => { draft.trainingDays = value; draft.daysPerWeek = Math.max(1, value.length); }));
    drawDays();
    const status = h('p', { class: 'tag', role: 'status' });
    return section('profile-title', 'Training profile', 'Used to build plans, pick exercises and give the coach context. Changing it does not alter existing plans.',
      textField({ label: 'First name', value: draft.name, maxLength: 40, onInput: value => { draft.name = value.trim(); } }),
      choices({ legend: 'Goal', name: 'set-goal', items: GOAL_CHOICES, selected: [draft.goal], onChange: ([value]) => { draft.goal = value as Goal; } }),
      choices({ legend: 'Experience', name: 'set-level', items: LEVEL_CHOICES, selected: [draft.level], onChange: ([value]) => { draft.level = value as Level; } }),
      choices({ legend: 'Equipment', name: 'set-equipment', multiple: true, items: EQUIPMENT_CHOICES, selected: draft.equipment, onChange: values => { draft.equipment = values; }, hint: 'Bodyweight exercises are always available.' }),
      segmented({ label: 'Days per week', name: 'set-days', value: String(draft.daysPerWeek), items: ['1', '2', '3', '4', '5', '6', '7'].map(value => ({ value, label: value })), onChange: value => { draft.daysPerWeek = Number(value); draft.trainingDays = DEFAULT_DAYS[draft.daysPerWeek]; drawDays(); } }),
      days,
      segmented({ label: 'Time per session', name: 'set-minutes', value: String(draft.minutes), items: ['20', '30', '45', '60', '75', '90'].map(value => ({ value, label: `${value} min` })), onChange: value => { draft.minutes = Number(value); } }),
      segmented({ label: 'Units', name: 'set-units', value: draft.units, items: [{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }], onChange: value => { draft.units = value as Units; } }),
      h('div', { class: 'row' },
        button('Save profile', () => {
          if (!draft.trainingDays.length) { toast('Pick at least one training day.', { kind: 'error' }); return; }
          try {
            store.saveProfile({ ...draft, daysPerWeek: draft.trainingDays.length, equipment: ['bodyweight', ...draft.equipment] } as Profile);
            status.textContent = 'Saved';
            toast('Profile saved. New plans and coach answers will use it.');
          } catch (error) { toast(error instanceof Error ? error.message : 'Could not save.', { kind: 'error' }); }
        }, { variant: 'primary', icon: 'check' }),
        status));
  }

  function preferencesSection() {
    const prefs = store.prefs;
    const update = (change: Partial<typeof prefs>) => { try { store.savePrefs({ ...store.prefs, ...change }); } catch (error) { toast(error instanceof Error ? error.message : 'Could not save.', { kind: 'error' }); } };
    return [
      section('workout-title', 'During workouts', 'How the active workout behaves.',
        h('div', null,
          switchRow({ label: 'Start rest timer automatically', text: 'After you log a set, the rest for that exercise begins.', checked: prefs.autoRest, onChange: value => update({ autoRest: value }) }),
          switchRow({ label: 'Sound cues', text: 'A soft chime when rest ends and a tick for the last three seconds.', checked: prefs.sound, onChange: value => update({ sound: value }) }),
          switchRow({ label: 'Vibration', text: 'On devices that support it.', checked: prefs.vibration, onChange: value => update({ vibration: value }) }))),
      section('appearance-title', 'Appearance & motion', 'Training screens are dark by design. Reading screens follow this setting.',
        segmented({ label: 'Reading screens', name: 'theme', value: prefs.theme, items: [{ value: 'system', label: 'Match system' }, { value: 'light', label: 'Ivory' }, { value: 'dark', label: 'Graphite' }], onChange: value => update({ theme: value as typeof prefs.theme }) }),
        segmented({ label: 'Motion', name: 'motion', value: prefs.motion, items: [{ value: 'system', label: 'Match system' }, { value: 'reduced', label: 'Reduced' }], onChange: value => update({ motion: value as typeof prefs.motion }) })),
    ];
  }

  function coachSection() {
    const providers = store.config?.providers ?? [];
    const current = store.provider();
    return section('coach-title', 'AI coach', 'Icarus Offline is always available. AI providers turn on when the server has their key or CLI path; nothing is sent until you message the coach.',
      providers.length ? h('ul', { class: 'provider-list', role: 'list' }, providers.map(item => h('li', { class: `provider${item.enabled ? '' : ' off'}` },
        h('div', { class: 'row between' },
          h('div', { class: 'stack', style: { '--stack': '4px' } }, h('p', { class: 'list-title' }, item.label), h('p', { class: 'list-meta' }, item.id === 'offline' ? 'Built in · no AI model' : `Model: ${item.model}`)),
          item.enabled
            ? (item.id === current ? h('span', { class: 'tag signal' }, h('span', { class: 'dot' }), 'In use') : button('Use', () => { store.savePrefs({ ...store.prefs, provider: item.id }); draw(); toast(`${item.label} selected for the coach.`); }, { size: 'small' }))
            : h('span', { class: 'tag' }, 'Not set up')),
        h('p', { class: 'small muted' }, item.detail),
        !item.enabled && SETUP[item.id] ? h('details', { class: 'setup' }, h('summary', { class: 'small' }, 'Show setup'), h('pre', { class: 'code' }, `# In the .env file next to package.json\n${SETUP[item.id]}`), h('p', { class: 'small muted' }, 'Restart the server after changing .env. Keys stay on the server and are never sent to the browser.'))
          : null)))
        : h('p', { class: 'notice warn' }, icon('alert'), store.configError || 'Connecting to the server…'));
  }

  function dataSection() {
    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'import-file', onchange: async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      (event.target as HTMLInputElement).value = '';
      if (!file) return;
      if (file.size > 5_000_000) { toast('That file is too large to be an Icarus export.', { kind: 'error' }); return; }
      let data: unknown;
      try { data = JSON.parse(await file.text()); } catch { toast('That file is not valid JSON.', { kind: 'error' }); return; }
      if (await confirmDialog({ title: 'Replace your data?', text: 'Your current profile, plans and history on this device will be replaced by the file. Export first if you want to keep them.', confirm: 'Replace data', danger: true }) !== true) return;
      try { const result = store.importData(data); toast(`Imported ${result.plans} plans and ${result.workouts} workouts.`); context.navigate(store.profile ? '#/today' : '#/welcome'); }
      catch (error) { toast(error instanceof Error ? error.message : 'Import failed. Nothing was changed.', { kind: 'error' }); }
    } });
    const exportData = () => {
      const blob = new Blob([JSON.stringify(store.repo.exportAll(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = h('a', { href: url, download: `icarus-backup-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('Backup downloaded.');
    };
    return section('data-title', 'Your data', 'Everything is stored in this browser only. It is not synced to other devices and can be lost if you clear site data, so export a backup now and then.',
      h('div', { class: 'stats data-stats' },
        h('div', { class: 'stat' }, h('p', { class: 'stat-label' }, 'Plans'), h('p', { class: 'numeral' }, String(store.plans.length))),
        h('div', { class: 'stat' }, h('p', { class: 'stat-label' }, 'Workouts'), h('p', { class: 'numeral' }, String(store.history.length))),
        h('div', { class: 'stat' }, h('p', { class: 'stat-label' }, 'Storage'), h('p', { class: 'numeral small-numeral' }, store.persistent ? 'This browser' : 'Temporary'))),
      h('div', { class: 'row' },
        button('Export backup', exportData, { icon: 'download' }),
        h('label', { class: 'btn', for: 'import-file', tabindex: '0', role: 'button', onkeydown: (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); } } }, icon('upload'), 'Import backup'), fileInput,
        button('Re-run setup', () => context.navigate('#/onboarding'), { variant: 'ghost', icon: 'user' })),
      h('div', { class: 'danger-zone' },
        h('p', { class: 'small' }, h('strong', null, 'Delete everything. '), 'Removes your profile, plans, history, preferences and coach conversation from this browser.'),
        button('Delete all data', async () => {
          if (await confirmDialog({ title: 'Delete all Icarus data?', text: 'This permanently removes everything stored in this browser. It cannot be undone.', confirm: 'Delete everything', danger: true }) !== true) return;
          store.clearAll();
          toast('All data deleted.');
          context.navigate('#/welcome');
        }, { variant: 'danger', icon: 'trash', size: 'small' })));
  }

  function draw() {
    replace(el, h('div', { class: 'container' },
      h('header', { class: 'page-head' }, eyebrow('Settings'), h('h1', { class: 'display' }, 'Tuned to ', h('em', null, 'you.'))),
      profileSection(), ...preferencesSection(), coachSection(), dataSection(),
      h('section', { class: 'settings-section about' },
        h('div', { class: 'settings-label' }, h('h2', { class: 'title' }, 'About')),
        h('div', { class: 'settings-content stack' },
          h('p', { class: 'small muted' }, `Icarus ${store.config?.appVersion ?? ''}. General fitness guidance for healthy adults; not medical advice. Stop exercising and seek help if you feel pain, dizziness or chest discomfort.`),
          h('p', { class: 'small muted' }, 'There are no accounts. This is a single-person app: anyone using this browser profile sees the same data.'),
          h('a', { class: 'text-link small', href: '/web/fonts/LICENSES.txt', target: '_blank', rel: 'noopener' }, 'Font licences')))));
  }
  draw();
  return { el, title: 'Settings', surface: 'light', nav: 'settings' };
}
