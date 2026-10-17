import type { Equipment, Exercise, Level, Muscle, Pattern } from './types.js';

type Def = [
  id: string, name: string, pattern: Pattern, primary: Muscle[], secondary: Muscle[], equipment: Equipment[],
  level: Level, kind: 'reps' | 'time', loaded: boolean, compound: boolean, summary: string, cues: string[], mistakes: string[],
];

// General technique guidance for healthy adults. It is not a substitute for in-person coaching.
const DEFS: Def[] = [
  // Squat pattern
  ['bodyweight-squat', 'Bodyweight Squat', 'squat', ['quads', 'glutes'], ['core'], [], 'beginner', 'reps', false, true,
    'The foundation of lower-body training: sit between your heels, stand tall.',
    ['Feet shoulder-width, toes turned out slightly', 'Push the knees out in line with the toes', 'Keep your chest proud and heels down'],
    ['Heels lifting off the floor', 'Knees caving inward on the way up']],
  ['goblet-squat', 'Goblet Squat', 'squat', ['quads', 'glutes'], ['core'], ['dumbbells'], 'beginner', 'reps', true, true,
    'A dumbbell held at the chest keeps the torso upright and teaches depth.',
    ['Hold the dumbbell vertically against your sternum', 'Elbows track inside the knees at the bottom', 'Drive up through the whole foot'],
    ['Letting the weight drift away from the chest', 'Rounding the lower back at depth']],
  ['back-squat', 'Barbell Back Squat', 'squat', ['quads', 'glutes'], ['hamstrings', 'core'], ['barbell'], 'intermediate', 'reps', true, true,
    'The benchmark strength lift for the legs and trunk.',
    ['Bar on the upper back, hands just outside the shoulders', 'Brace your trunk before each rep', 'Hips and chest rise together'],
    ['Good-morning the weight up with the hips first', 'Losing the brace between reps']],
  ['front-squat', 'Front Squat', 'squat', ['quads'], ['glutes', 'core'], ['barbell'], 'advanced', 'reps', true, true,
    'Bar in the front rack demands an upright torso and strong upper back.',
    ['Elbows high, bar resting on the shoulders', 'Sit straight down between the heels', 'Keep elbows up out of the hole'],
    ['Elbows dropping and the bar rolling forward', 'Cutting depth short']],
  ['leg-press', 'Leg Press', 'squat', ['quads', 'glutes'], ['hamstrings'], ['machines'], 'beginner', 'reps', true, true,
    'Heavy leg work with the back supported.',
    ['Feet mid-platform, shoulder-width', 'Lower until the knees reach about 90 degrees', 'Keep your lower back against the pad'],
    ['Locking the knees hard at the top', 'Lowering so deep the hips curl off the pad']],
  // Hinge
  ['romanian-deadlift', 'Romanian Deadlift', 'hinge', ['hamstrings', 'glutes'], ['back'], ['dumbbells'], 'beginner', 'reps', true, true,
    'A hip hinge that loads the hamstrings through a long range.',
    ['Soft knees, push the hips straight back', 'Weights slide close along the thighs', 'Stop when the hamstrings are fully stretched'],
    ['Rounding the back to reach lower', 'Bending the knees into a squat']],
  ['deadlift', 'Barbell Deadlift', 'hinge', ['hamstrings', 'glutes', 'back'], ['quads', 'core'], ['barbell'], 'intermediate', 'reps', true, true,
    'Lift the bar from the floor with the whole posterior chain.',
    ['Bar over mid-foot, shins close', 'Pull the slack out of the bar before it moves', 'Push the floor away, then lock out with the glutes'],
    ['Jerking the bar off the floor', 'Leaning back past vertical at lockout']],
  ['kettlebell-swing', 'Kettlebell Swing', 'hinge', ['glutes', 'hamstrings'], ['core', 'cardio'], ['kettlebell'], 'intermediate', 'reps', true, true,
    'An explosive hinge that builds power and conditioning.',
    ['Hike the bell back high between the thighs', 'Snap the hips forward; the arms just guide', 'Finish tall with glutes and abs tight'],
    ['Squatting the swing instead of hinging', 'Lifting the bell with the shoulders']],
  ['good-morning', 'Banded Good Morning', 'hinge', ['hamstrings', 'glutes'], ['back'], ['bands'], 'beginner', 'reps', false, true,
    'A gentle hinge pattern with band tension, ideal for warm-ups and home training.',
    ['Band under the feet and behind the neck', 'Hinge at the hips with a long spine', 'Squeeze the glutes to stand'],
    ['Rounding the upper back', 'Rushing the lowering phase']],
  // Lunge
  ['reverse-lunge', 'Reverse Lunge', 'lunge', ['quads', 'glutes'], ['hamstrings', 'core'], [], 'beginner', 'reps', false, true,
    'A knee-friendly single-leg move: step back, drop straight down.',
    ['Step back far enough for two 90-degree angles', 'Keep the front heel planted', 'Drive through the front foot to return'],
    ['Front knee collapsing inward', 'Torso pitching far forward']],
  ['dumbbell-lunge', 'Dumbbell Walking Lunge', 'lunge', ['quads', 'glutes'], ['hamstrings', 'core'], ['dumbbells'], 'intermediate', 'reps', true, true,
    'Loaded lunges that build single-leg strength and balance.',
    ['Long, controlled steps', 'Back knee hovers just above the floor', 'Stay tall with the weights at your sides'],
    ['Short choppy steps that overload the knee', 'Letting the back knee slam down']],
  ['split-squat', 'Bulgarian Split Squat', 'lunge', ['quads', 'glutes'], ['core'], ['bench'], 'intermediate', 'reps', false, true,
    'Rear foot elevated on a bench for a deep single-leg squat.',
    ['Rear laces on the bench', 'Lower straight down, front shin slightly forward', 'Keep your hips square'],
    ['Standing too close to the bench', 'Pushing off the back foot']],
  // Horizontal push
  ['push-up', 'Push-up', 'push-floor', ['chest', 'triceps'], ['shoulders', 'core'], [], 'beginner', 'reps', false, true,
    'The essential upper-body push. Elevate the hands to make it easier.',
    ['Hands under the shoulders, body in one line', 'Elbows about 45 degrees from the torso', 'Chest touches just above the floor'],
    ['Hips sagging toward the floor', 'Flaring the elbows straight out']],
  ['incline-push-up', 'Incline Push-up', 'push-floor', ['chest', 'triceps'], ['shoulders'], ['bench'], 'beginner', 'reps', false, true,
    'Hands on a bench to reduce the load while you build strength.',
    ['Hands on the edge of the bench', 'Squeeze glutes to keep a straight line', 'Lower under control, chest to the bench'],
    ['Piking the hips up', 'Half reps that stop short']],
  ['dumbbell-bench-press', 'Dumbbell Bench Press', 'press-bench', ['chest', 'triceps'], ['shoulders'], ['dumbbells', 'bench'], 'beginner', 'reps', true, true,
    'A free-weight press with a natural path for each arm.',
    ['Shoulder blades pinned back and down', 'Lower to the outside of the chest', 'Press up and slightly in'],
    ['Bouncing the dumbbells off the chest', 'Letting the wrists bend back']],
  ['bench-press', 'Barbell Bench Press', 'press-bench', ['chest', 'triceps'], ['shoulders'], ['barbell', 'bench'], 'intermediate', 'reps', true, true,
    'The classic heavy upper-body press. Use safeties or a spotter.',
    ['Feet planted, slight arch, shoulder blades set', 'Touch the lower chest under control', 'Drive the bar back over the shoulders'],
    ['Lifting the hips off the bench', 'Flaring the elbows to 90 degrees']],
  ['cable-fly', 'Cable Chest Fly', 'press-bench', ['chest'], ['shoulders'], ['cable'], 'intermediate', 'reps', true, false,
    'Constant tension through a wide hugging arc.',
    ['Slight bend in the elbows, fixed throughout', 'Bring the hands together in front of the chest', 'Control the stretch on the way back'],
    ['Turning it into a press', 'Overstretching the shoulders']],
  ['dip', 'Bench Dip', 'extension', ['triceps'], ['chest', 'shoulders'], ['bench'], 'beginner', 'reps', false, false,
    'Triceps work using a bench behind you.',
    ['Hands at the bench edge, fingers forward', 'Lower until the elbows reach 90 degrees', 'Keep the hips close to the bench'],
    ['Dropping too deep and stressing the shoulders', 'Shrugging the shoulders up']],
  // Vertical push
  ['overhead-press', 'Dumbbell Overhead Press', 'press-overhead', ['shoulders'], ['triceps', 'core'], ['dumbbells'], 'beginner', 'reps', true, true,
    'Press overhead while standing tall and braced.',
    ['Start with the dumbbells at shoulder height', 'Ribs down, glutes tight', 'Finish with the biceps by the ears'],
    ['Leaning back to finish the rep', 'Pressing forward instead of up']],
  ['barbell-press', 'Standing Barbell Press', 'press-overhead', ['shoulders', 'triceps'], ['core'], ['barbell'], 'intermediate', 'reps', true, true,
    'The strict overhead press: full-body tension, bar in a straight line.',
    ['Bar on the front shoulders, forearms vertical', 'Move the head back, press, then push through', 'Lock out over the mid-foot'],
    ['Pushing the hips forward', 'Pressing around the face']],
  ['pike-push-up', 'Pike Push-up', 'press-overhead', ['shoulders', 'triceps'], ['core'], [], 'intermediate', 'reps', false, true,
    'A bodyweight overhead press with the hips high.',
    ['Hips high, body in an upside-down V', 'Lower the head between the hands', 'Press back up through the palms'],
    ['Bending the knees to cheat', 'Head landing in front of the hands']],
  ['band-press', 'Band Overhead Press', 'press-overhead', ['shoulders'], ['triceps'], ['bands'], 'beginner', 'reps', false, true,
    'Overhead pressing with band tension, gentle on the joints.',
    ['Stand on the band, handles at the shoulders', 'Press straight up', 'Lower slowly against the band'],
    ['Arching the lower back', 'Letting the band snap you down']],
  // Vertical pull
  ['pull-up', 'Pull-up', 'pull-vertical', ['back', 'biceps'], ['core'], ['pullup-bar'], 'intermediate', 'reps', false, true,
    'The gold standard for upper-back strength.',
    ['Start from a dead hang, shoulders engaged', 'Pull the elbows down to the ribs', 'Chin over the bar, then lower fully'],
    ['Kicking or swinging', 'Stopping halfway down']],
  ['chin-up', 'Chin-up', 'pull-vertical', ['back', 'biceps'], [], ['pullup-bar'], 'intermediate', 'reps', false, true,
    'Palms-facing pull-up with more biceps involvement.',
    ['Shoulder-width underhand grip', 'Lead with the chest toward the bar', 'Control every inch of the descent'],
    ['Craning the neck to reach', 'Shrugging at the bottom']],
  ['lat-pulldown', 'Lat Pulldown', 'pull-vertical', ['back'], ['biceps'], ['cable'], 'beginner', 'reps', true, true,
    'Vertical pulling you can load precisely.',
    ['Grip just outside the shoulders', 'Pull the bar to the upper chest', 'Lean back only slightly'],
    ['Pulling behind the neck', 'Using momentum to swing the weight']],
  ['band-pulldown', 'Band Lat Pulldown', 'pull-vertical', ['back'], ['biceps'], ['bands'], 'beginner', 'reps', false, true,
    'Anchor a band overhead to train the lats at home.',
    ['Kneel facing the anchor, arms long', 'Drive the elbows down and back', 'Pause with the shoulder blades squeezed'],
    ['Bending forward at the hips', 'Rushing the return']],
  // Row
  ['dumbbell-row', 'One-arm Dumbbell Row', 'row', ['back'], ['biceps'], ['dumbbells'], 'beginner', 'reps', true, true,
    'Supported single-arm rowing for a strong, even back.',
    ['One hand and knee on a bench or thigh', 'Pull the elbow toward the hip', 'Keep the torso still and square'],
    ['Twisting to lift more', 'Shrugging the weight up']],
  ['barbell-row', 'Barbell Row', 'row', ['back'], ['biceps', 'hamstrings'], ['barbell'], 'intermediate', 'reps', true, true,
    'A heavy hinge-and-row for the whole back.',
    ['Hinge to about 45 degrees, back flat', 'Row the bar to the lower ribs', 'Lower with control, keep the hinge'],
    ['Standing up as the set gets hard', 'Jerking the bar with the hips']],
  ['inverted-row', 'Inverted Row', 'row', ['back'], ['biceps', 'core'], ['pullup-bar'], 'beginner', 'reps', false, true,
    'A bodyweight row under a low bar or sturdy table.',
    ['Body straight from heels to head', 'Pull the chest to the bar', 'Squeeze the shoulder blades at the top'],
    ['Hips dropping', 'Reaching with the chin']],
  ['cable-row', 'Seated Cable Row', 'row', ['back'], ['biceps'], ['cable'], 'beginner', 'reps', true, true,
    'Smooth horizontal pulling with constant tension.',
    ['Sit tall with a slight knee bend', 'Pull the handle to the belly button', 'Let the shoulders reach forward on the return'],
    ['Rocking the torso back and forth', 'Rounding the lower back']],
  ['band-row', 'Band Row', 'row', ['back'], ['biceps'], ['bands'], 'beginner', 'reps', false, true,
    'Horizontal rowing anywhere with an anchored band.',
    ['Step back until the band is taut', 'Row the elbows past the ribs', 'Hold for a second, return slowly'],
    ['Leaning back to create tension', 'Shrugging toward the ears']],
  ['face-pull', 'Face Pull', 'row', ['shoulders', 'back'], [], ['cable'], 'intermediate', 'reps', true, false,
    'Rear-delt and rotator cuff work for healthy shoulders.',
    ['Rope at face height, thumbs back', 'Pull toward the eyes, elbows high', 'Rotate the hands back at the finish'],
    ['Using too much weight and leaning back', 'Elbows dropping below the hands']],
  ['doorway-row', 'Doorway Row', 'row', ['back', 'biceps'], [], [], 'beginner', 'reps', false, true,
    'A bodyweight row holding a sturdy door frame. Walk the feet closer to make it harder.',
    ['Hold both sides of a solid door frame', 'Lean back with straight arms and a rigid body', 'Pull the chest to the frame, elbows close'],
    ['Using a door that can swing or slip', 'Bending at the hips instead of rowing']],
  ['superman', 'Superman Hold', 'hinge', ['back', 'glutes'], ['hamstrings'], [], 'beginner', 'time', false, false,
    'Back-extension endurance lying face down.',
    ['Lift the chest, arms and legs a few centimetres', 'Keep the neck long, eyes on the floor', 'Squeeze the glutes throughout'],
    ['Cranking the neck back', 'Lifting so high the lower back pinches']],
  ['prone-y-raise', 'Prone Y Raise', 'raise', ['shoulders', 'back'], [], [], 'beginner', 'reps', false, false,
    'Lower-trap and rear-shoulder work lying face down.',
    ['Arms overhead in a Y, thumbs up', 'Lift the arms by pulling the shoulder blades down', 'Pause, then lower slowly'],
    ['Shrugging toward the ears', 'Arching the lower back to lift higher']],
  ['wall-sit', 'Wall Sit', 'squat', ['quads'], ['glutes'], [], 'beginner', 'time', false, false,
    'An isometric squat hold against a wall.',
    ['Back flat on the wall, thighs parallel to the floor', 'Knees over the ankles', 'Breathe steadily through the hold'],
    ['Knees drifting past the toes', 'Hands pushing on the thighs']],
  // Arms
  ['dumbbell-curl', 'Dumbbell Curl', 'curl', ['biceps'], [], ['dumbbells'], 'beginner', 'reps', true, false,
    'Simple, effective elbow flexion.',
    ['Elbows pinned at your sides', 'Turn the palms up as you curl', 'Lower for a slow count of two'],
    ['Swinging the torso', 'Elbows drifting forward']],
  ['hammer-curl', 'Hammer Curl', 'curl', ['biceps'], [], ['dumbbells'], 'beginner', 'reps', true, false,
    'Neutral-grip curls for the biceps and forearms.',
    ['Thumbs up throughout', 'Curl without moving the upper arm', 'Squeeze briefly at the top'],
    ['Rushing the lowering phase', 'Shrugging the shoulders']],
  ['band-curl', 'Band Curl', 'curl', ['biceps'], [], ['bands'], 'beginner', 'reps', false, false,
    'Biceps work with rising band tension.',
    ['Stand on the band, palms up', 'Curl to the shoulders', 'Resist the band on the way down'],
    ['Leaning back', 'Letting the band pull the arms straight quickly']],
  ['triceps-extension', 'Overhead Triceps Extension', 'extension', ['triceps'], [], ['dumbbells'], 'beginner', 'reps', true, false,
    'Long-head triceps work with a single dumbbell overhead.',
    ['Hold the dumbbell with both hands overhead', 'Lower behind the head, elbows pointing up', 'Extend fully without flaring'],
    ['Elbows splaying wide', 'Arching the lower back']],
  ['cable-pushdown', 'Cable Triceps Pushdown', 'extension', ['triceps'], [], ['cable'], 'beginner', 'reps', true, false,
    'Isolated triceps extension with steady tension.',
    ['Elbows tucked at the sides', 'Press down until the arms are straight', 'Let the forearms rise to parallel only'],
    ['Leaning over the weight', 'Elbows drifting forward']],
  ['diamond-push-up', 'Diamond Push-up', 'push-floor', ['triceps', 'chest'], ['shoulders'], [], 'intermediate', 'reps', false, true,
    'A close-hand push-up that shifts the work to the triceps.',
    ['Index fingers and thumbs touch under the chest', 'Elbows brush the ribs', 'Keep a rigid plank'],
    ['Hips sagging', 'Partial range at the bottom']],
  // Shoulders
  ['lateral-raise', 'Lateral Raise', 'raise', ['shoulders'], [], ['dumbbells'], 'beginner', 'reps', true, false,
    'Builds the side of the shoulders.',
    ['Slight bend in the elbows', 'Raise out to shoulder height, leading with the elbows', 'Lower slowly'],
    ['Shrugging the weight up', 'Swinging with the hips']],
  ['band-pull-apart', 'Band Pull-apart', 'raise', ['shoulders', 'back'], [], ['bands'], 'beginner', 'reps', false, false,
    'Upper-back and rear-delt work, great between pressing sets.',
    ['Arms straight in front at shoulder height', 'Pull the band to the chest', 'Squeeze the shoulder blades together'],
    ['Bending the elbows', 'Arching the lower back']],
  // Core
  ['plank', 'Front Plank', 'plank', ['core'], ['shoulders'], [], 'beginner', 'time', false, false,
    'Anti-extension core strength. Quality beats duration.',
    ['Elbows under the shoulders', 'Squeeze glutes and pull the ribs down', 'Breathe slowly through the hold'],
    ['Hips sagging or piking', 'Holding your breath']],
  ['side-plank', 'Side Plank', 'plank', ['core'], ['shoulders'], [], 'beginner', 'time', false, false,
    'Lateral core stability for the obliques.',
    ['Elbow under the shoulder', 'Hips high, body in one line', 'Switch sides halfway through the set'],
    ['Hips dropping toward the floor', 'Rolling the chest forward']],
  ['dead-bug', 'Dead Bug', 'crunch', ['core'], [], [], 'beginner', 'reps', false, false,
    'Controlled core work that keeps the lower back safe.',
    ['Lower back pressed into the floor', 'Extend the opposite arm and leg slowly', 'Exhale fully as you reach'],
    ['Lower back arching off the floor', 'Moving too fast']],
  ['crunch', 'Crunch', 'crunch', ['core'], [], [], 'beginner', 'reps', false, false,
    'Short-range trunk flexion for the abdominals.',
    ['Knees bent, feet flat', 'Curl the ribs toward the hips', 'Keep the chin slightly tucked'],
    ['Yanking on the neck', 'Using momentum']],
  ['hanging-knee-raise', 'Hanging Knee Raise', 'crunch', ['core'], [], ['pullup-bar'], 'intermediate', 'reps', false, false,
    'Lower-ab work from a hang.',
    ['Start from a still dead hang', 'Curl the pelvis up as the knees rise', 'Lower without swinging'],
    ['Swinging for momentum', 'Only lifting the thighs, not the pelvis']],
  ['cable-crunch', 'Cable Crunch', 'crunch', ['core'], [], ['cable'], 'intermediate', 'reps', true, false,
    'Loaded trunk flexion with a rope.',
    ['Kneel with the rope beside the head', 'Crunch the ribs toward the pelvis', 'Hips stay still'],
    ['Sitting back with the hips', 'Pulling with the arms']],
  // Glutes and calves
  ['glute-bridge', 'Glute Bridge', 'bridge', ['glutes'], ['hamstrings'], [], 'beginner', 'reps', false, false,
    'Direct glute work from the floor.',
    ['Feet flat, close to the hips', 'Drive through the heels to lift', 'Pause with the ribs down at the top'],
    ['Arching the lower back at the top', 'Pushing through the toes']],
  ['hip-thrust', 'Hip Thrust', 'bridge', ['glutes'], ['hamstrings'], ['barbell', 'bench'], 'intermediate', 'reps', true, false,
    'The strongest loaded glute exercise.',
    ['Upper back on the bench edge', 'Chin tucked, ribs down', 'Shins vertical at the top'],
    ['Overextending the lower back', 'Feet too far forward']],
  ['calf-raise', 'Standing Calf Raise', 'calf', ['calves'], [], [], 'beginner', 'reps', false, false,
    'Full-range calf work; use a step for extra stretch.',
    ['Rise as high as possible onto the big toe', 'Pause at the top', 'Lower slowly into a full stretch'],
    ['Bouncing at the bottom', 'Rolling onto the outer foot']],
  ['dumbbell-calf-raise', 'Dumbbell Calf Raise', 'calf', ['calves'], [], ['dumbbells'], 'beginner', 'reps', true, false,
    'Loaded calf raises with dumbbells at the sides.',
    ['Balls of the feet on a step', 'Full stretch at the bottom', 'Two-second squeeze at the top'],
    ['Short, bouncing reps', 'Bending the knees']],
  // Conditioning and carries
  ['jumping-jack', 'Jumping Jacks', 'cardio', ['cardio'], ['calves'], [], 'beginner', 'time', false, false,
    'A simple way to raise the heart rate.',
    ['Land softly on the balls of the feet', 'Arms move in rhythm with the legs', 'Keep a steady breathing pace'],
    ['Landing flat-footed and heavy', 'Holding your breath']],
  ['high-knees', 'High Knees', 'cardio', ['cardio'], ['core', 'quads'], [], 'beginner', 'time', false, false,
    'Fast running in place that builds conditioning.',
    ['Drive the knees to hip height', 'Stay tall and light on the feet', 'Pump the arms'],
    ['Leaning back', 'Letting the knees drop as you tire']],
  ['burpee', 'Burpee', 'cardio', ['cardio'], ['chest', 'quads'], [], 'intermediate', 'reps', false, true,
    'Full-body conditioning: squat, plank, stand, jump.',
    ['Hands down, jump the feet back to a plank', 'Chest to the floor if you can', 'Jump the feet in and stand tall'],
    ['Sagging hips in the plank', 'Landing on straight legs']],
  ['mountain-climber', 'Mountain Climbers', 'cardio', ['core', 'cardio'], ['shoulders'], [], 'beginner', 'time', false, false,
    'Core and conditioning from a high plank.',
    ['Hands under the shoulders', 'Drive the knees toward the chest', 'Keep the hips level'],
    ['Hips bouncing high', 'Shoulders drifting behind the hands']],
  ['farmer-carry', "Farmer's Carry", 'carry', ['core'], ['back', 'shoulders'], ['dumbbells'], 'beginner', 'time', true, true,
    'Walk tall with heavy weights for grip, trunk and posture.',
    ['Stand tall, shoulders down and back', 'Short, quick steps', 'Grip hard; do not let the weights swing'],
    ['Leaning to one side', 'Shrugging the shoulders']],
  ['kettlebell-carry', 'Kettlebell Suitcase Carry', 'carry', ['core'], ['back'], ['kettlebell'], 'beginner', 'time', true, true,
    'A one-sided carry that trains the obliques.',
    ['Bell in one hand, stay perfectly upright', 'Walk slowly with control', 'Switch hands halfway'],
    ['Leaning away from the weight', 'Rushing the walk']],
  // Mobility
  ['worlds-greatest-stretch', "World's Greatest Stretch", 'mobility', ['hamstrings', 'glutes'], ['back'], [], 'beginner', 'time', false, false,
    'A flowing mobility drill for hips, hamstrings and thoracic spine.',
    ['Long lunge, back knee down if needed', 'Rotate the top arm to the ceiling', 'Move slowly and breathe'],
    ['Forcing range that is not there', 'Holding your breath']],
  ['cat-cow', 'Cat-Cow', 'mobility', ['back'], ['core'], [], 'beginner', 'time', false, false,
    'Gentle spinal mobility on hands and knees.',
    ['Hands under shoulders, knees under hips', 'Round the spine, then let it sag gently', 'Match movement to breath'],
    ['Moving only from the neck', 'Rushing']],
];

export const EXERCISES: Exercise[] = DEFS.map(([id, name, pattern, primary, secondary, equipment, level, kind, loaded, compound, summary, cues, mistakes]) =>
  ({ id, name, pattern, primary, secondary, equipment, level, kind, loaded, compound, summary, cues, mistakes }));

const BY_ID = new Map(EXERCISES.map(exercise => [exercise.id, exercise]));

export function exerciseById(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

const LEVEL_RANK: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };
export function levelAllows(user: Level, exercise: Level) {
  return LEVEL_RANK[exercise] <= LEVEL_RANK[user];
}

export function available(exercise: Exercise, equipment: readonly Equipment[]) {
  return exercise.equipment.every(item => item === 'bodyweight' || equipment.includes(item));
}

/** Alternatives that train the same thing and fit the user's equipment, closest match first. */
export function substitutes(id: string, equipment: readonly Equipment[], level: Level = 'advanced'): Exercise[] {
  const source = exerciseById(id);
  if (!source) return [];
  const score = (candidate: Exercise) =>
    (candidate.pattern === source.pattern ? 4 : 0) +
    candidate.primary.filter(muscle => source.primary.includes(muscle)).length * 2 +
    (candidate.kind === source.kind ? 1 : 0);
  return EXERCISES
    .filter(candidate => candidate.id !== id && available(candidate, equipment) && levelAllows(level, candidate.level))
    .map(candidate => ({ candidate, value: score(candidate) }))
    .filter(entry => entry.value >= 3)
    .sort((a, b) => b.value - a.value || a.candidate.name.localeCompare(b.candidate.name))
    .map(entry => entry.candidate);
}

/** Loose name matching used to map coach-written exercise names onto the catalog. */
export function findExercise(name: string): Exercise | undefined {
  const clean = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const target = clean(name);
  if (!target) return undefined;
  return EXERCISES.find(exercise => clean(exercise.name) === target || exercise.id === target.replace(/ /g, '-'))
    ?? EXERCISES.find(exercise => target.includes(clean(exercise.name)) || clean(exercise.name).includes(target));
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', quads: 'Quads',
  hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', core: 'Core', cardio: 'Conditioning',
};
export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  bodyweight: 'Bodyweight', dumbbells: 'Dumbbells', barbell: 'Barbell & rack', kettlebell: 'Kettlebell', bench: 'Bench',
  'pullup-bar': 'Pull-up bar', bands: 'Resistance bands', cable: 'Cable station', machines: 'Machines',
};
