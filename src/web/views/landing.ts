import { EXERCISES } from '../../shared/fitness/exercises.js';
import { SPLITS } from '../../shared/fitness/programs.js';
import { h } from '../core/dom.js';
import type { View } from '../core/router.js';
import { store } from '../core/store.js';
import { heroArt, mark } from '../ui/brand.js';
import { eyebrow, linkButton, ring } from '../ui/components.js';
import { figure } from '../ui/figure.js';
import { icon } from '../ui/icons.js';

export function landingView(): View {
  const onboarded = Boolean(store.profile);
  const primary = onboarded
    ? linkButton("Enter today's session", '#/today', { variant: 'primary', iconAfter: 'arrow' })
    : linkButton('Begin your programme', '#/onboarding', { variant: 'primary', iconAfter: 'arrow' });
  const method = h('section', { class: 'landing-method surface-light', id: 'method', 'aria-labelledby': 'method-title' });
  const explore = h('button', { type: 'button', class: 'btn ghost', onclick: () => method.scrollIntoView({ behavior: 'smooth' }) }, 'Explore the method', icon('down'));

  const specs = [
    [String(EXERCISES.length), 'Exercises with technique cues'],
    [String(SPLITS.length), 'Training splits, beginner to advanced'],
    ['0', 'Accounts required'],
    ['1 tap', 'To log a set'],
  ];

  const chapters: [string, string, string, string, string][] = [
    ['01', 'Plan', 'A programme shaped to <em>you</em>.', 'Tell Icarus your goal, experience, equipment and schedule. It drafts a split (full body, upper and lower, push, pull and legs) that you can reshape exercise by exercise.', 'goblet-squat'],
    ['02', 'Train', 'Every set, <em>accounted</em> for.', 'Large controls, loads carried over from last time, and a rest clock that keeps counting when your phone sleeps or you switch apps.', 'dumbbell-bench-press'],
    ['03', 'Measure', 'Progress you can <em>see</em>.', 'Weekly streaks, personal bests and training volume, calculated only from what you actually logged.', 'romanian-deadlift'],
  ];
  const withEmphasis = (text: string) => text.split(/(<em>[^<]+<\/em>)/g).filter(Boolean).map(part => part.startsWith('<em>') ? h('em', null, part.slice(4, -5)) : part);

  method.append(h('div', { class: 'container section' },
    h('div', { class: 'section-intro' }, eyebrow('The method'), h('h2', { class: 'display', id: 'method-title' }, 'Three disciplines.', h('br'), h('em', null, 'One system.'))),
    h('ol', { class: 'chapters', role: 'list' }, chapters.map(([number, label, title, text, exercise]) => h('li', { class: 'chapter' },
      h('div', { class: 'chapter-figure' }, figure(exercise, { title: `${label} illustration` })),
      h('div', { class: 'chapter-text stack' },
        h('p', { class: 'chapter-number numeral', 'aria-hidden': 'true' }, number),
        eyebrow(label),
        h('h3', { class: 'headline' }, withEmphasis(title)),
        h('p', { class: 'body' }, text)))))));

  const restRing = ring(260, 2);
  restRing.update(0.62);
  const session = h('section', { class: 'landing-session', 'aria-labelledby': 'session-title' },
    h('div', { class: 'container section split' },
      h('div', { class: 'stack', style: { '--stack': '20px' } },
        eyebrow('In session'),
        h('h2', { class: 'display', id: 'session-title' }, 'The clock is', h('br'), h('em', null, 'yours to command.')),
        h('p', { class: 'lead' }, 'Log a set and the rest timer starts on its own. Add fifteen seconds, skip ahead, or pause the whole session. Leave the screen and it keeps time; come back and it is exactly where it should be.'),
        h('ul', { class: 'feature-list', role: 'list' }, ['Loads pre-filled from your last session', 'Technique cues and common mistakes for every exercise', 'Personal bests flagged the moment you set them'].map(text => h('li', null, icon('check'), text)))),
      h('div', { class: 'session-preview', 'aria-label': 'Interface preview', role: 'img' },
        h('div', { class: 'ring preview-ring' }, restRing.svg, h('div', { class: 'ring-center' }, h('p', { class: 'eyebrow' }, 'Rest'), h('p', { class: 'numeral preview-time' }, '1:14'), h('p', { class: 'small muted' }, 'Next · Set 3 of 4'))),
        h('ol', { class: 'preview-sets', role: 'list' }, ([['1', '22.5 kg', '10', true], ['2', '22.5 kg', '9', true], ['3', '22.5 kg', '8', false], ['4', '22.5 kg', '8', false]] as [string, string, string, boolean][]).map(([n, load, reps, done]) =>
          h('li', { class: done ? 'done' : '' }, h('span', { class: 'numeral' }, n), h('span', null, load), h('span', null, `× ${reps}`), done ? icon('check') : h('span', { class: 'pending' }))) ),
        h('p', { class: 'preview-caption tag' }, 'Interface preview'))));

  const prompts = ['A 30-minute leg session with dumbbells', 'Recommend a 4-day split for me', 'How do I fix my squat depth?', 'Swap barbell rows for something at home'];
  const coach = h('section', { class: 'landing-coach', 'aria-labelledby': 'coach-title' },
    h('div', { class: 'container section' },
      h('div', { class: 'coach-quote stack', style: { '--stack': '24px' } },
        eyebrow('The coach'),
        h('h2', { class: 'display', id: 'coach-title' }, 'Ask anything.', h('br'), h('em', null, 'Leave with a session.')),
        h('p', { class: 'lead' }, 'Workouts for any muscle group, weekly splits, substitutions for your equipment and clear explanations of sets, reps and rest. Suggested sessions start with one tap. The built-in coach works with no account; connect Claude or OpenAI for open-ended conversation.'),
        h('ul', { class: 'prompt-list', role: 'list' }, prompts.map(text => h('li', null, h('span', { class: 'prompt-mark', 'aria-hidden': 'true' }, '“'), text))))));

  const privacy = h('section', { class: 'landing-privacy surface-light', 'aria-labelledby': 'privacy-title' },
    h('div', { class: 'container section-tight split' },
      h('div', { class: 'stack' }, eyebrow('Ownership'), h('h2', { class: 'headline', id: 'privacy-title' }, 'Your training stays', h('br'), h('em', null, 'on this device.'))),
      h('div', { class: 'stack' },
        h('p', { class: 'body' }, 'Icarus keeps your profile, plans and history in this browser. There is no account and nothing is synchronised between devices, so export a backup from Settings if you switch browsers.'),
        h('p', { class: 'body' }, 'AI coaching is optional. When you use an AI coach, your message and a short training summary are sent to the provider you choose, through the Icarus server.'))));

  const el = h('div', { class: 'landing' },
    h('section', { class: 'hero', 'aria-labelledby': 'hero-title' },
      heroArt(),
      h('div', { class: 'container hero-inner' },
        h('div', { class: 'hero-copy' },
          h('p', { class: 'eyebrow reveal', style: { '--i': '0' } }, 'Icarus · Performance coaching'),
          h('h1', { class: 'hero-title reveal', id: 'hero-title', style: { '--i': '1' } }, 'Rise with', h('br'), h('em', null, 'discipline.')),
          h('p', { class: 'lead reveal', style: { '--i': '2' } }, 'Plans built around your goals and equipment. Guided sessions with a rest clock that never loses count. A coach that explains every rep. Engineered with the care of a hand-built machine.'),
          h('div', { class: 'row reveal', style: { '--i': '3' } }, primary, explore)),
        h('dl', { class: 'hero-specs reveal-late' }, specs.map(([value, label]) => h('div', null, h('dt', { class: 'numeral' }, value), h('dd', null, label)))))),
    method, session, coach, privacy,
    h('section', { class: 'landing-final' },
      h('div', { class: 'container section final-inner' },
        h('div', { class: 'final-mark', 'aria-hidden': 'true' }, mark('')),
        h('h2', { class: 'display' }, 'Begin the ', h('em', null, 'ascent.')),
        h('p', { class: 'lead' }, 'Five short questions. A plan in under a minute.'),
        primary.cloneNode(true) as HTMLElement)),
    h('footer', { class: 'footer' }, h('div', { class: 'container row' }, h('span', { class: 'wordmark' }, 'Icarus'), h('span', null, 'General fitness guidance, not medical advice. Stop and seek help if you feel pain or dizziness.'))));

  return { el, title: 'Rise with discipline', surface: 'dark', nav: 'welcome' };
}
