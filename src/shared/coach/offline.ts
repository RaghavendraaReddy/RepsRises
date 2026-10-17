import { EXERCISES, exerciseById, findExercise, substitutes } from '../fitness/exercises.js';
import { describeTarget, estimateMinutes, generateSession, recommendedSplit, SPLITS } from '../fitness/programs.js';
import type { Equipment, Goal, Level } from '../fitness/types.js';
import type { CoachContext, CoachMessage, CoachReply, DraftExercise } from './contracts.js';

// The built-in coach. Rule-based and deterministic: no model, no network. It answers the common
// questions well and builds real sessions from the same generator the plan builder uses.

const SYMPTOMS = /\b(pain|painful|hurts?|hurting|injur(y|ed|ies)|dizz(y|iness)|faint|light-?headed|chest (pain|tight)|numb(ness)?|tingl|sharp|pop(ped)?|swollen|swelling|can'?t breathe|short(ness)? of breath|palpitation|nause)/i;

const MUSCLE_WORDS: [RegExp, string][] = [
  [/\bfull[- ]?body|everything|total body\b/i, 'full'], [/\bchest|pecs?\b/i, 'chest'], [/\bback|lats?\b/i, 'back'], [/\bshoulders?|delts?\b/i, 'shoulders'],
  [/\barms?\b/i, 'arms'], [/\bbiceps?\b/i, 'biceps'], [/\btriceps?\b/i, 'triceps'], [/\blegs?|lower body|quads?\b/i, 'legs'], [/\bglutes?|butt|hamstrings?\b/i, 'glutes'],
  [/\bcore|abs?|abdominals?|obliques?\b/i, 'core'], [/\bcardio|conditioning|hiit|sweat|endurance session\b/i, 'cardio'], [/\bmobility|stretch(ing)?|recovery|flexib/i, 'mobility'],
  [/\bupper body\b/i, 'chest'], [/\bupper body\b/i, 'back'], [/\bupper body\b/i, 'shoulders'], [/\bpush\b/i, 'chest'], [/\bpush\b/i, 'shoulders'], [/\bpull\b/i, 'back'], [/\bpull\b/i, 'biceps'],
];

function minutesFrom(text: string): number | null {
  const match = text.match(/(\d{1,3})\s*(-|to)?\s*(\d{1,3})?\s*(min|minute|mins|m\b)/i);
  if (match) return Math.max(5, Math.min(180, Number(match[3] ?? match[1])));
  if (/half an hour/i.test(text)) return 30;
  if (/an hour|one hour|1 hour/i.test(text)) return 60;
  if (/quick|short/i.test(text)) return 20;
  return null;
}

function equipmentFrom(text: string, fallback: Equipment[]): Equipment[] {
  if (/no equipment|bodyweight|body weight|no weights|hotel|travel/i.test(text)) return ['bodyweight'];
  const found: Equipment[] = [];
  if (/dumbbell/i.test(text)) found.push('dumbbells');
  if (/barbell/i.test(text)) found.push('barbell', 'bench');
  if (/kettlebell/i.test(text)) found.push('kettlebell');
  if (/\bbands?\b/i.test(text)) found.push('bands');
  if (/full gym|at the gym|in the gym/i.test(text)) return ['dumbbells', 'barbell', 'kettlebell', 'bench', 'pullup-bar', 'cable', 'machines', 'bands'];
  return found.length ? found : fallback;
}

function levelFrom(text: string, fallback: Level): Level {
  if (/beginner|new to|first time|easy|gentle|go easy/i.test(text)) return 'beginner';
  if (/advanced|brutal|hardest|very hard|experienced/i.test(text)) return 'advanced';
  if (/harder|challenge|intermediate/i.test(text) && fallback === 'beginner') return 'intermediate';
  return fallback;
}

function draft(exerciseIds: ReturnType<typeof generateSession>): DraftExercise[] {
  return exerciseIds.map(item => {
    const exercise = exerciseById(item.exerciseId)!;
    return { name: exercise.name, exerciseId: exercise.id, sets: item.sets, reps: item.reps, repsMax: item.repsMax, seconds: item.seconds, restSec: item.restSec, cue: exercise.cues[0] };
  });
}

const titleCase = (text: string) => text.replace(/\b\w/g, char => char.toUpperCase());
const MUSCLE_TITLE: Record<string, string> = { full: 'Full Body', chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms', biceps: 'Biceps', triceps: 'Triceps', legs: 'Legs', glutes: 'Glutes & Hamstrings', core: 'Core', cardio: 'Conditioning', mobility: 'Mobility' };

const KNOWLEDGE: [RegExp, string, string[]][] = [
  [/\b(what('?s| is| are)? (a )?(set|rep)s?|sets? (and|vs|&) reps?|how many (sets|reps))/i,
    'A **rep** is one complete movement; a **set** is a group of reps done back to back.\n\n- **Strength:** 3–6 reps, 3–5 sets, longer rest (2–3 min).\n- **Muscle growth:** 6–12 reps, 3–4 sets, 60–120 s rest.\n- **Endurance:** 12–20 reps, 2–3 sets, short rest (30–60 s).\n\nWhatever the range, finish most sets with one to three good reps left in the tank.',
    ['How long should I rest?', 'How do I progress?']],
  [/\brest(ing)? (time|period|between)|how long (should i )?rest/i,
    'Rest long enough to repeat your quality on the next set.\n\n- **Heavy compound lifts:** 2–3 minutes.\n- **Moderate work (8–12 reps):** 60–90 seconds.\n- **Small muscles and core:** 30–60 seconds.\n\nIcarus starts a rest timer after every set you log; you can add time or skip it.',
    ['What are sets and reps?', 'How do I progress?']],
  [/\bprogress(ion|ive overload)?|get stronger|plateau|stall/i,
    'Progress by making one thing slightly harder over time:\n\n1. **Reps first:** when you hit the top of your rep range on every set, add load next time.\n2. **Then load:** the smallest jump available (1–2.5 kg upper body, 2.5–5 kg lower body).\n3. **Stalled for 2–3 weeks?** Drop the load by about 10% and build back up, or swap to a close variation.\n\nIcarus pre-fills your last loads so you always know what to beat.',
    ['Build me a strength plan', 'What is a deload?']],
  [/\bdeload/i,
    'A **deload** is a planned easier week, usually every 4–8 weeks of hard training: keep the same exercises but cut sets by about half and use around 10% less load. It lets joints and fatigue recover so the next block goes better.',
    ['How do I progress?', 'Build me a 4-day plan']],
  [/\bwarm[- ]?up/i,
    'A good warm-up takes 5–8 minutes:\n\n1. 2–3 minutes of easy cardio to raise your temperature.\n2. A few mobility drills for the joints you will use.\n3. **Ramp-up sets** of your first lift: a light set of 8, a medium set of 5, then a heavier set of 2–3 before your working weight.',
    ['Give me a mobility session', 'Build me a full-body workout']],
  [/\b(rpe|rir|reps in reserve|how hard)/i,
    '**RIR (reps in reserve)** is how many more good reps you could have done. Most working sets should end at **1–3 RIR**. Going to failure occasionally on safe exercises is fine; doing it on every heavy compound set mostly adds fatigue.',
    ['How do I progress?', 'What are sets and reps?']],
  [/\bhow (often|many days)|frequency|days a week/i,
    'For most goals, **training each muscle about twice a week** works well. Three full-body days, four upper/lower days or a five-day hybrid all achieve that. Choose the schedule you can repeat for months; consistency beats the perfect split.',
    ['Recommend a split for me', 'Build me a 4-day plan']],
];

function safetyReply(): CoachReply {
  return {
    reply: '**Stop the exercise that caused it.** Pain, dizziness, chest tightness, numbness or shortness of breath are signals to rest, not to push through.\n\n- If symptoms are severe, sudden, or involve your chest or breathing, **seek medical help now**.\n- For anything that lingers or returns when you train, see a doctor or physiotherapist before loading it again.\n\nI cannot diagnose injuries. Once you have been cleared, I can help you plan around it.',
    workout: null, split: null, suggestions: ['Give me a gentle mobility session', 'What should I do instead today?'],
  };
}

export function offlineCoach(input: CoachMessage[], context: CoachContext): CoachReply {
  const messages = rewriteFollowUp(input);
  let text = messages.at(-1)?.content.trim() ?? '';
  // "Explain the first exercise" refers to the last workout the coach suggested.
  if (/\b(first|that|this) exercise\b/i.test(text)) {
    const previous = [...messages].reverse().find(message => message.role === 'assistant')?.content ?? '';
    const named = [...previous.matchAll(/\*\*([^*]+)\*\*/g)].map(match => findExercise(match[1])).find(Boolean);
    if (named) text = `How do I do ${named.name}?`;
  }
  const level: Level = context.level ?? 'beginner';
  const goal: Goal = context.goal ?? 'general';
  const equipment: Equipment[] = context.equipment.length ? context.equipment : ['bodyweight'];
  const audience = context.audience;
  const kidsNote = audience === 'kids' ? '\n\nFor children: keep it playful, stop while they are still enjoying it, and make sure an adult is supervising.' : audience === 'older' ? '\n\nMove at a comfortable pace, use support for balance when you need it, and stop if anything feels wrong.' : '';

  if (SYMPTOMS.test(text) && !/(how|what).*(prevent|avoid)/i.test(text)) return safetyReply();

  if (/^(hi|hello|hey|yo|good (morning|evening|afternoon))\b/i.test(text) || /what can you (do|help)/i.test(text)) {
    const name = context.name ? `, ${context.name}` : '';
    return {
      reply: `Good to see you${name}. I can build a session for any muscle group, recommend a weekly split, explain technique, sets and rest, and suggest swaps for your equipment.\n\nTell me what you want to train and how long you have.`,
      workout: null, split: null, suggestions: ['Full body, 45 minutes', 'Recommend a split for me', 'How do I progress?'],
    };
  }

  const exercise = findExercise(text.replace(/^(how (do|should) i (do|perform)|form (for|on)|cues? for|technique (for|on)|teach me|explain|replace|substitute|swap|alternative(s)? (to|for)|instead of)\s+/i, '').replace(/[?.!]+$/, ''))
    ?? EXERCISES.find(item => text.toLowerCase().includes(item.name.toLowerCase()));

  if (exercise && /\b(replace|substitut|swap|alternative|instead of|don'?t have|can'?t do)/i.test(text)) {
    const options = substitutes(exercise.id, equipment, level, audience).slice(0, 4);
    if (!options.length) return { reply: `I could not find a close match for **${exercise.name}** with your current equipment. Adding a set of resistance bands opens up most movement patterns.`, workout: null, split: null, suggestions: ['Update my equipment', 'Build me a bodyweight workout'] };
    return {
      reply: `Good swaps for **${exercise.name}** with your equipment:\n\n${options.map(item => `- **${item.name}**: ${item.summary}`).join('\n')}\n\nKeep the same sets and rep range, and choose a load that leaves 1–3 reps in reserve.`,
      workout: null, split: null, suggestions: [`How do I do ${options[0].name}?`, 'Build me a workout with these'],
    };
  }

  if (exercise && /\b(how|form|cue|technique|teach|explain|tips?|mistake|perform|do i)\b/i.test(text)) {
    return {
      reply: `**${exercise.name}.** ${exercise.summary}\n\n**Cues**\n${exercise.cues.map(cue => `- ${cue}`).join('\n')}\n\n**Common mistakes**\n${exercise.mistakes.map(item => `- ${item}`).join('\n')}\n\nStart light enough that every rep looks the same, then add load gradually.`,
      workout: null, split: null, suggestions: [`Alternatives to ${exercise.name}`, 'Build me a workout'],
    };
  }

  for (const [pattern, answer, suggestions] of KNOWLEDGE) if (pattern.test(text)) return { reply: answer, workout: null, split: null, suggestions };

  if (/\b(split|program|routine|weekly|per week|a week|days? plan|plan for (the|my) week|schedule)\b/i.test(text)) {
    const days = Number(text.match(/(\d)\s*[- ]?days?/i)?.[1] ?? context.plan.match(/(\d) days/)?.[1] ?? 3);
    const split = recommendedSplit(Math.max(1, Math.min(7, days)), levelFrom(text, level), audience);
    const info = SPLITS.find(item => item.id === split)!;
    return {
      reply: `For ${days} day${days === 1 ? '' : 's'} a week at ${levelFrom(text, level) === 'intermediate' ? 'an' : 'a'} ${levelFrom(text, level)} level, I recommend **${info.name}**. ${info.summary}\n\nI will fill it with exercises that match your equipment, and you can change anything in the plan builder. Treat it as a strong starting point, not a guarantee; adjust it to how you recover.${kidsNote}`,
      workout: null, split, suggestions: ['How do I progress?', 'How long should I rest?'],
    };
  }

  const muscles = [...new Set(MUSCLE_WORDS.filter(([pattern]) => pattern.test(text)).map(([, muscle]) => muscle))];
  const wantsWorkout = muscles.length > 0 || /\b(workout|session|train(ing)?|exercise|routine|circuit|today)\b/i.test(text);
  if (wantsWorkout) {
    const minutes = minutesFrom(text) ?? context.minutes ?? 45;
    const chosenLevel = levelFrom(text, level);
    const chosenEquipment = equipmentFrom(text, equipment);
    const items = generateSession({ muscles: muscles.length ? muscles : ['full'], level: chosenLevel, goal, equipment: chosenEquipment, minutes, audience });
    if (!items.length) return { reply: 'I could not build that session with your equipment. Try a different focus, or update your equipment in Settings.', workout: null, split: null, suggestions: ['Full body, bodyweight only'] };
    const title = muscles.length ? muscles.slice(0, 3).map(muscle => MUSCLE_TITLE[muscle] ?? titleCase(muscle)).join(' & ') : 'Full Body';
    const estimate = estimateMinutes(items);
    const lines = items.map(item => `- **${exerciseById(item.exerciseId)!.name}** · ${describeTarget(item)}`).join('\n');
    return {
      reply: `Here is ${chosenLevel === 'intermediate' ? 'an' : 'a'} ${chosenLevel} **${title}** session, about ${estimate} minutes${chosenEquipment.length === 1 && chosenEquipment[0] === 'bodyweight' ? ', bodyweight only' : ''}.\n\n${lines}\n\nWarm up for five minutes first. Pick loads that leave 1–3 good reps in reserve; stop any exercise that causes pain.${kidsNote}`,
      workout: { title, focus: muscles.length ? `${title} focus` : 'Balanced full-body session', minutes: estimate, exercises: draft(items) },
      split: null, suggestions: ['Make it shorter', 'Make it harder', 'Explain the first exercise'],
    };
  }

  return {
    reply: 'I can help with that best if you tell me what to train. For example: "a 30-minute leg session with dumbbells", "recommend a 4-day split", or "how do I do a Romanian deadlift?".',
    workout: null, split: null, suggestions: ['Build me a full-body workout', 'Recommend a split for me', 'How do I progress?'],
  };
}

/** Follow-up adjustments to the last suggested workout ("shorter", "harder") are handled by re-asking with context. */
export function rewriteFollowUp(messages: CoachMessage[]): CoachMessage[] {
  const last = messages.at(-1)?.content ?? '';
  if (!/^(make it )?(shorter|harder|easier|longer)/i.test(last)) return messages;
  const previous = [...messages].reverse().find(message => message.role === 'user' && !/^(make it )?(shorter|harder|easier|longer)/i.test(message.content))?.content ?? 'full body workout';
  const base = previous.replace(/\d{1,3}\s*(min|minutes|mins)/i, '');
  const extra = /shorter/i.test(last) ? ' 20 min' : /longer/i.test(last) ? ' 60 min' : /harder/i.test(last) ? ' advanced' : ' beginner';
  return [...messages.slice(0, -1), { role: 'user', content: base + extra }];
}
