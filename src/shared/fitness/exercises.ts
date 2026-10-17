import { INSTRUCTIONS } from './exercise-instructions.js';
import type { Audience, Equipment, Exercise, Level, Muscle, Pattern } from './types.js';

type Def = {
  id: string; name: string; pattern: Pattern; primary: Muscle[]; secondary?: Muscle[]; equipment?: Equipment[];
  level: Level; kind?: 'reps' | 'time'; loaded?: boolean; compound?: boolean; summary: string; cues: string[]; mistakes: string[];
  photo: string; photoNote?: string; audiences?: Audience[]; easier?: string; harder?: string;
};

const A: Audience[] = ['adults'];
const AO: Audience[] = ['adults', 'older'];
const ALL: Audience[] = ['kids', 'adults', 'older'];
const AK: Audience[] = ['kids', 'adults'];

// Coaching cues and mistakes are Icarus editorial guidance for healthy adults (not reviewed by a
// certified professional). Photos and step-by-step instructions come from Free Exercise DB.
const DEFS: Def[] = [
  // ── Legs: squat and lunge patterns ─────────────────────────────────────────
  { id: 'bodyweight-squat', name: 'Bodyweight Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['core'], level: 'beginner', compound: true, audiences: ALL, harder: 'goblet-squat', photo: 'Bodyweight_Squat',
    summary: 'The foundation of lower-body training: sit between your heels and stand tall.',
    cues: ['Feet shoulder-width, toes turned out slightly', 'Knees track in line with the toes', 'Chest proud, heels down throughout'], mistakes: ['Heels lifting off the floor', 'Knees caving inward on the way up'] },
  { id: 'goblet-squat', name: 'Goblet Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['core'], equipment: ['dumbbells'], level: 'beginner', loaded: true, compound: true, audiences: AO, easier: 'bodyweight-squat', harder: 'back-squat',
    photo: 'Goblet_Squat', photoNote: 'Shown with a kettlebell; a dumbbell held vertically works the same way.',
    summary: 'A weight held at the chest keeps the torso upright and teaches depth.',
    cues: ['Hold the weight against your sternum', 'Elbows track inside the knees at the bottom', 'Drive up through the whole foot'], mistakes: ['Letting the weight drift away from the chest', 'Rounding the lower back at depth'] },
  { id: 'back-squat', name: 'Barbell Back Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core'], equipment: ['barbell'], level: 'intermediate', loaded: true, compound: true, audiences: A, easier: 'goblet-squat', harder: 'front-squat', photo: 'Barbell_Squat',
    summary: 'The benchmark strength lift for the legs and trunk. Use a rack with safety arms.',
    cues: ['Bar on the upper back, hands just outside the shoulders', 'Brace your trunk before each rep', 'Hips and chest rise together'], mistakes: ['Hips shooting up first out of the bottom', 'Losing the brace between reps'] },
  { id: 'front-squat', name: 'Front Squat', pattern: 'squat', primary: ['quads'], secondary: ['glutes', 'core'], equipment: ['barbell'], level: 'advanced', loaded: true, compound: true, audiences: A, easier: 'back-squat', photo: 'Front_Barbell_Squat',
    summary: 'Bar in the front rack demands an upright torso and a strong upper back.',
    cues: ['Elbows high, bar resting on the shoulders', 'Sit straight down between the heels', 'Keep the elbows up out of the bottom'], mistakes: ['Elbows dropping and the bar rolling forward', 'Cutting depth short'] },
  { id: 'leg-press', name: 'Leg Press', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: ['machines'], level: 'beginner', loaded: true, compound: true, audiences: AO, photo: 'Leg_Press',
    summary: 'Heavy leg work with the back supported, a good option when balance is a concern.',
    cues: ['Feet mid-platform, shoulder-width', 'Lower until the knees reach about 90 degrees', 'Keep your lower back against the pad'], mistakes: ['Locking the knees hard at the top', 'Lowering so deep the hips curl off the pad'] },
  { id: 'walking-lunge', name: 'Walking Lunge', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core'], level: 'beginner', compound: true, audiences: AK, harder: 'dumbbell-lunge', photo: 'Bodyweight_Walking_Lunge',
    summary: 'Single-leg strength and balance with nothing but floor space.',
    cues: ['Long, controlled steps', 'Back knee hovers just above the floor', 'Stay tall, eyes forward'], mistakes: ['Short, choppy steps that overload the front knee', 'Torso pitching far forward'] },
  { id: 'dumbbell-lunge', name: 'Dumbbell Lunge', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core'], equipment: ['dumbbells'], level: 'intermediate', loaded: true, compound: true, audiences: A, easier: 'walking-lunge', photo: 'Dumbbell_Lunges',
    summary: 'Loaded lunges that build single-leg strength and balance.',
    cues: ['Weights hang at your sides', 'Drop straight down, front heel planted', 'Push through the front foot to return'], mistakes: ['Front knee collapsing inward', 'Letting the back knee slam down'] },
  { id: 'split-squat', name: 'Split Squat', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['hamstrings'], level: 'beginner', compound: true, audiences: AO, harder: 'dumbbell-lunge', photo: 'Split_Squats',
    summary: 'A stationary lunge: feet stay put while you lower and rise.',
    cues: ['Stagger the feet a long stride apart', 'Lower straight down, torso tall', 'Hold a wall or rail if balance is unsteady'], mistakes: ['Standing with the feet too close together', 'Pushing mostly off the back foot'] },
  { id: 'dumbbell-step-up', name: 'Dumbbell Step-up', pattern: 'lunge', primary: ['quads', 'glutes'], equipment: ['dumbbells', 'bench'], level: 'intermediate', loaded: true, compound: true, audiences: A, easier: 'step-up-knee-raise', photo: 'Dumbbell_Step_Ups',
    summary: 'Step onto a box or bench with control; the working leg does all the lifting.',
    cues: ['Whole foot on the step', 'Drive through the heel of the top leg', 'Lower slowly rather than dropping down'], mistakes: ['Pushing off the bottom foot', 'Using a step so high the hips tilt'] },
  { id: 'step-up-knee-raise', name: 'Step-up with Knee Raise', pattern: 'lunge', primary: ['glutes', 'quads'], secondary: ['core'], level: 'beginner', compound: true, audiences: ALL, harder: 'dumbbell-step-up', photo: 'Step-up_with_Knee_Raise',
    summary: 'A step-up finished with a knee lift: strength, balance and coordination together.',
    cues: ['Use a low, stable step', 'Stand tall before lifting the knee', 'Hold a rail nearby for balance if needed'], mistakes: ['Rushing the step', 'Leaning on the raised knee'] },
  // ── Hinge and glutes ───────────────────────────────────────────────────────
  { id: 'romanian-deadlift', name: 'Dumbbell Romanian Deadlift', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['back'], equipment: ['dumbbells'], level: 'beginner', loaded: true, compound: true, audiences: AO, harder: 'barbell-rdl', photo: 'Stiff-Legged_Dumbbell_Deadlift',
    summary: 'A hip hinge that loads the hamstrings through a long range.',
    cues: ['Soft knees, push the hips straight back', 'Weights slide close along the thighs', 'Stop when the hamstrings are fully stretched'], mistakes: ['Rounding the back to reach lower', 'Bending the knees into a squat'] },
  { id: 'barbell-rdl', name: 'Barbell Romanian Deadlift', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['back'], equipment: ['barbell'], level: 'intermediate', loaded: true, compound: true, audiences: A, easier: 'romanian-deadlift', harder: 'deadlift', photo: 'Romanian_Deadlift',
    summary: 'The same hinge with a barbell, so you can load it heavier.',
    cues: ['Start standing with the bar at the hips', 'Bar stays in contact with the legs', 'Squeeze the glutes to stand tall'], mistakes: ['Letting the bar drift forward', 'Leaning back at the top'] },
  { id: 'deadlift', name: 'Barbell Deadlift', pattern: 'hinge', primary: ['hamstrings', 'glutes', 'back'], secondary: ['quads', 'core'], equipment: ['barbell'], level: 'intermediate', loaded: true, compound: true, audiences: A, easier: 'barbell-rdl', photo: 'Barbell_Deadlift',
    summary: 'Lift the bar from the floor with the whole posterior chain.',
    cues: ['Bar over mid-foot, shins close', 'Take the slack out of the bar before it moves', 'Push the floor away, then lock out with the glutes'], mistakes: ['Jerking the bar off the floor', 'Leaning back past vertical at lockout'] },
  { id: 'single-leg-rdl', name: 'Single-leg Kettlebell Deadlift', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['core'], equipment: ['kettlebell'], level: 'intermediate', loaded: true, compound: true, audiences: A, easier: 'romanian-deadlift', photo: 'Kettlebell_One-Legged_Deadlift',
    summary: 'A one-leg hinge that builds balance and evens out left-right differences.',
    cues: ['Hips stay square to the floor', 'Back leg and torso move as one line', 'Light weight until balance is solid'], mistakes: ['Opening the hips to the side', 'Rounding the back to reach the floor'] },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing', pattern: 'hinge', primary: ['glutes', 'hamstrings'], secondary: ['core', 'cardio'], equipment: ['kettlebell'], level: 'intermediate', loaded: true, compound: true, audiences: A, photo: 'One-Arm_Kettlebell_Swings',
    summary: 'An explosive hinge that builds power and conditioning.',
    cues: ['Hike the bell back high between the thighs', 'Snap the hips forward; the arm just guides', 'Finish tall with glutes and abs tight'], mistakes: ['Squatting the swing instead of hinging', 'Lifting the bell with the shoulder'] },
  { id: 'good-morning', name: 'Banded Good Morning', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['back'], equipment: ['bands'], level: 'beginner', compound: true, audiences: AO, photo: 'Band_Good_Morning',
    summary: 'A gentle hinge with band tension, good for warm-ups and home training.',
    cues: ['Band under the feet and behind the neck', 'Hinge at the hips with a long spine', 'Squeeze the glutes to stand'], mistakes: ['Rounding the upper back', 'Rushing the lowering phase'] },
  { id: 'glute-bridge', name: 'Glute Bridge', pattern: 'bridge', primary: ['glutes'], secondary: ['hamstrings'], level: 'beginner', audiences: ALL, harder: 'single-leg-glute-bridge', photo: 'Butt_Lift_Bridge',
    summary: 'Direct glute work from the floor, gentle on the back.',
    cues: ['Feet flat, close to the hips', 'Drive through the heels to lift', 'Pause with the ribs down at the top'], mistakes: ['Arching the lower back at the top', 'Pushing through the toes'] },
  { id: 'single-leg-glute-bridge', name: 'Single-leg Glute Bridge', pattern: 'bridge', primary: ['glutes'], secondary: ['hamstrings', 'core'], level: 'intermediate', audiences: A, easier: 'glute-bridge', harder: 'hip-thrust', photo: 'Single_Leg_Glute_Bridge',
    summary: 'The bridge on one leg doubles the load without any equipment.',
    cues: ['Lift the free leg and keep it still', 'Hips stay level as you rise', 'Pause for a second at the top'], mistakes: ['One hip dropping', 'Pushing from the lower back'] },
  { id: 'hip-thrust', name: 'Barbell Hip Thrust', pattern: 'bridge', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['barbell', 'bench'], level: 'intermediate', loaded: true, audiences: A, easier: 'single-leg-glute-bridge', photo: 'Barbell_Hip_Thrust',
    summary: 'The strongest loaded glute exercise. Pad the bar.',
    cues: ['Upper back on the bench edge', 'Chin tucked, ribs down', 'Shins vertical at the top'], mistakes: ['Overextending the lower back', 'Feet too far forward'] },
  { id: 'glute-kickback', name: 'Glute Kickback', pattern: 'bridge', primary: ['glutes'], secondary: ['core'], level: 'beginner', audiences: AO, photo: 'Glute_Kickback',
    summary: 'Hands-and-knees glute work that teaches hip extension without load.',
    cues: ['Hands under shoulders, knees under hips', 'Kick back until the thigh is level with the body', 'Keep the lower back still'], mistakes: ['Swinging the leg with momentum', 'Arching the back to lift higher'] },
  { id: 'superman', name: 'Superman Hold', pattern: 'plank', primary: ['back', 'glutes'], secondary: ['hamstrings'], kind: 'time', level: 'beginner', audiences: ALL, photo: 'Superman',
    summary: 'Back-extension endurance lying face down.',
    cues: ['Lift the chest, arms and legs a few centimetres', 'Neck long, eyes on the floor', 'Squeeze the glutes throughout'], mistakes: ['Cranking the neck back', 'Lifting so high the lower back pinches'] },
  // ── Chest and triceps ──────────────────────────────────────────────────────
  { id: 'push-up', name: 'Push-up', pattern: 'push-floor', primary: ['chest', 'triceps'], secondary: ['shoulders', 'core'], level: 'beginner', compound: true, audiences: AK, easier: 'incline-push-up', harder: 'close-grip-push-up', photo: 'Pushups',
    summary: 'The essential upper-body push.',
    cues: ['Hands under the shoulders, body in one line', 'Elbows about 45 degrees from the torso', 'Chest to just above the floor'], mistakes: ['Hips sagging toward the floor', 'Flaring the elbows straight out'] },
  { id: 'incline-push-up', name: 'Incline Push-up', pattern: 'push-floor', primary: ['chest', 'triceps'], secondary: ['shoulders'], equipment: ['bench'], level: 'beginner', compound: true, audiences: ALL, harder: 'push-up', photo: 'Incline_Push-Up',
    summary: 'Hands raised on a bench, box or sturdy surface to reduce the load.',
    cues: ['Hands on a stable edge', 'Squeeze the glutes to keep a straight line', 'Lower under control, chest to the edge'], mistakes: ['Piking the hips up', 'Half reps that stop short'] },
  { id: 'close-grip-push-up', name: 'Close-grip Push-up', pattern: 'push-floor', primary: ['triceps', 'chest'], secondary: ['shoulders'], level: 'intermediate', compound: true, audiences: A, easier: 'push-up', photo: 'Close-Grip_Push-Up_off_of_a_Dumbbell', photoNote: 'Shown with hands on a dumbbell; hands close together on the floor works the same way.',
    summary: 'Hands close together shifts the work to the triceps.',
    cues: ['Hands just inside shoulder-width', 'Elbows brush the ribs', 'Keep a rigid plank'], mistakes: ['Hips sagging', 'Partial range at the bottom'] },
  { id: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', pattern: 'press-bench', primary: ['chest', 'triceps'], secondary: ['shoulders'], equipment: ['dumbbells', 'bench'], level: 'beginner', loaded: true, compound: true, audiences: AO, harder: 'bench-press', photo: 'Dumbbell_Bench_Press',
    summary: 'A free-weight press with a natural path for each arm.',
    cues: ['Shoulder blades pinned back and down', 'Lower to the outside of the chest', 'Press up and slightly in'], mistakes: ['Bouncing the dumbbells off the chest', 'Letting the wrists bend back'] },
  { id: 'dumbbell-floor-press', name: 'Dumbbell Floor Press', pattern: 'press-bench', primary: ['chest', 'triceps'], equipment: ['dumbbells'], level: 'beginner', loaded: true, compound: true, audiences: AO, harder: 'dumbbell-bench-press', photo: 'Dumbbell_Floor_Press',
    summary: 'A pressing option without a bench: the floor limits the range and protects the shoulders.',
    cues: ['Lie with knees bent, feet flat', 'Lower until the upper arms touch the floor', 'Pause, then press'], mistakes: ['Slamming the elbows into the floor', 'Flaring the elbows to 90 degrees'] },
  { id: 'bench-press', name: 'Barbell Bench Press', pattern: 'press-bench', primary: ['chest', 'triceps'], secondary: ['shoulders'], equipment: ['barbell', 'bench'], level: 'intermediate', loaded: true, compound: true, audiences: A, easier: 'dumbbell-bench-press', photo: 'Barbell_Bench_Press_-_Medium_Grip',
    summary: 'The classic heavy upper-body press. Use safeties or a spotter.',
    cues: ['Feet planted, shoulder blades set', 'Touch the lower chest under control', 'Drive the bar back over the shoulders'], mistakes: ['Lifting the hips off the bench', 'Flaring the elbows to 90 degrees'] },
  { id: 'cable-fly', name: 'Cable Crossover', pattern: 'press-bench', primary: ['chest'], secondary: ['shoulders'], equipment: ['cable'], level: 'intermediate', loaded: true, audiences: A, photo: 'Cable_Crossover',
    summary: 'Constant tension through a wide hugging arc.',
    cues: ['Slight bend in the elbows, fixed throughout', 'Bring the hands together in front of the chest', 'Control the stretch on the way back'], mistakes: ['Turning it into a press', 'Overstretching the shoulders'] },
  { id: 'dip', name: 'Bench Dip', pattern: 'extension', primary: ['triceps'], secondary: ['chest', 'shoulders'], equipment: ['bench'], level: 'beginner', audiences: A, photo: 'Bench_Dips',
    summary: 'Triceps work using a bench behind you.',
    cues: ['Hands at the bench edge, fingers forward', 'Lower until the elbows reach 90 degrees', 'Keep the hips close to the bench'], mistakes: ['Dropping too deep and stressing the shoulders', 'Shrugging the shoulders up'] },
  { id: 'triceps-extension', name: 'One-arm Overhead Triceps Extension', pattern: 'extension', primary: ['triceps'], equipment: ['dumbbells'], level: 'beginner', loaded: true, audiences: AO, photo: 'Dumbbell_One-Arm_Triceps_Extension',
    summary: 'Long-head triceps work with a dumbbell overhead.',
    cues: ['Upper arm points straight up and stays still', 'Lower behind the head under control', 'Extend fully without flaring the elbow'], mistakes: ['Elbow drifting out to the side', 'Arching the lower back'] },
  { id: 'cable-pushdown', name: 'Cable Triceps Pushdown', pattern: 'extension', primary: ['triceps'], equipment: ['cable'], level: 'beginner', loaded: true, audiences: AO, photo: 'Triceps_Pushdown',
    summary: 'Isolated triceps extension with steady tension.',
    cues: ['Elbows tucked at the sides', 'Press down until the arms are straight', 'Let the forearms rise only to parallel'], mistakes: ['Leaning over the weight', 'Elbows drifting forward'] },
  // ── Shoulders ──────────────────────────────────────────────────────────────
  { id: 'overhead-press', name: 'Dumbbell Shoulder Press', pattern: 'press-overhead', primary: ['shoulders'], secondary: ['triceps', 'core'], equipment: ['dumbbells'], level: 'beginner', loaded: true, compound: true, audiences: AO, harder: 'barbell-press', photo: 'Dumbbell_Shoulder_Press',
    summary: 'Press overhead from the shoulders, seated or standing.',
    cues: ['Start with the dumbbells at shoulder height', 'Ribs down, glutes tight', 'Finish with the biceps by the ears'], mistakes: ['Leaning back to finish the rep', 'Pressing forward instead of up'] },
  { id: 'arnold-press', name: 'Arnold Press', pattern: 'press-overhead', primary: ['shoulders'], secondary: ['triceps'], equipment: ['dumbbells', 'bench'], level: 'intermediate', loaded: true, compound: true, audiences: A, easier: 'overhead-press', photo: 'Arnold_Dumbbell_Press',
    summary: 'A rotating press that works the front and sides of the shoulders.',
    cues: ['Start palms facing you at chin height', 'Rotate the palms forward as you press', 'Reverse the path on the way down'], mistakes: ['Rushing the rotation', 'Arching the back off the bench'] },
  { id: 'kettlebell-press', name: 'Alternating Kettlebell Press', pattern: 'press-overhead', primary: ['shoulders'], secondary: ['triceps', 'core'], equipment: ['kettlebell'], level: 'intermediate', loaded: true, compound: true, audiences: A, photo: 'Alternating_Kettlebell_Press',
    summary: 'Pressing one side at a time challenges the trunk to stay still.',
    cues: ['Bells resting in the rack position', 'Press one arm while the other stays braced', 'Keep the hips square'], mistakes: ['Leaning away from the pressing arm', 'Letting the wrist bend back'] },
  { id: 'barbell-press', name: 'Standing Barbell Press', pattern: 'press-overhead', primary: ['shoulders', 'triceps'], secondary: ['core'], equipment: ['barbell'], level: 'intermediate', loaded: true, compound: true, audiences: A, easier: 'overhead-press', photo: 'Standing_Military_Press',
    summary: 'The strict overhead press: full-body tension, bar in a straight line.',
    cues: ['Bar on the front shoulders, forearms vertical', 'Move the head back, press, then push through', 'Lock out over the mid-foot'], mistakes: ['Pushing the hips forward', 'Pressing around the face'] },
  { id: 'lateral-raise', name: 'Lateral Raise', pattern: 'raise', primary: ['shoulders'], equipment: ['dumbbells'], level: 'beginner', loaded: true, audiences: AO, photo: 'Side_Lateral_Raise',
    summary: 'Builds the side of the shoulders. Light weights work best.',
    cues: ['Slight bend in the elbows', 'Raise out to shoulder height, leading with the elbows', 'Lower slowly'], mistakes: ['Shrugging the weight up', 'Swinging with the hips'] },
  { id: 'rear-delt-raise', name: 'Seated Rear Delt Raise', pattern: 'raise', primary: ['shoulders', 'back'], equipment: ['dumbbells', 'bench'], level: 'intermediate', loaded: true, audiences: A, photo: 'Seated_Bent-Over_Rear_Delt_Raise',
    summary: 'Works the back of the shoulders for balanced posture.',
    cues: ['Sit at the bench end, chest over the thighs', 'Raise the arms out wide, thumbs slightly down', 'Pause, then lower slowly'], mistakes: ['Lifting the chest to swing the weight', 'Using heavy dumbbells'] },
  { id: 'band-pull-apart', name: 'Band Pull-apart', pattern: 'raise', primary: ['shoulders', 'back'], equipment: ['bands'], level: 'beginner', audiences: AO, photo: 'Band_Pull_Apart',
    summary: 'Upper-back and rear-shoulder work, good between pressing sets.',
    cues: ['Arms straight in front at shoulder height', 'Pull the band to the chest', 'Squeeze the shoulder blades together'], mistakes: ['Bending the elbows', 'Arching the lower back'] },
  { id: 'band-back-fly', name: 'Band Reverse Fly', pattern: 'raise', primary: ['shoulders', 'back'], equipment: ['bands'], level: 'beginner', audiences: AO, photo: 'Back_Flyes_-_With_Bands',
    summary: 'A reverse fly with band tension for posture and shoulder health.',
    cues: ['Anchor or hold the band in front of you', 'Open the arms wide with soft elbows', 'Return slowly against the band'], mistakes: ['Shrugging toward the ears', 'Letting the band snap back'] },
  { id: 'arm-circles', name: 'Arm Circles', pattern: 'mobility', primary: ['shoulders'], kind: 'time', level: 'beginner', audiences: ALL, photo: 'Arm_Circles',
    summary: 'A simple shoulder warm-up anyone can do.',
    cues: ['Arms out to the sides at shoulder height', 'Small circles first, then larger', 'Switch direction halfway'], mistakes: ['Shrugging the shoulders', 'Moving so fast it becomes flinging'] },
  // ── Back and biceps ────────────────────────────────────────────────────────
  { id: 'pull-up', name: 'Pull-up', pattern: 'pull-vertical', primary: ['back', 'biceps'], secondary: ['core'], equipment: ['pullup-bar'], level: 'intermediate', compound: true, audiences: A, easier: 'lat-pulldown', photo: 'Pullups',
    summary: 'The gold standard for upper-back strength.',
    cues: ['Start from a dead hang, shoulders engaged', 'Pull the elbows down to the ribs', 'Chin over the bar, then lower fully'], mistakes: ['Kicking or swinging', 'Stopping halfway down'] },
  { id: 'chin-up', name: 'Chin-up', pattern: 'pull-vertical', primary: ['back', 'biceps'], equipment: ['pullup-bar'], level: 'intermediate', compound: true, audiences: A, easier: 'lat-pulldown', photo: 'Chin-Up',
    summary: 'Palms-facing pull-up with more biceps involvement.',
    cues: ['Shoulder-width underhand grip', 'Lead with the chest toward the bar', 'Control every inch of the descent'], mistakes: ['Craning the neck to reach', 'Shrugging at the bottom'] },
  { id: 'lat-pulldown', name: 'Lat Pulldown', pattern: 'pull-vertical', primary: ['back'], secondary: ['biceps'], equipment: ['cable'], level: 'beginner', loaded: true, compound: true, audiences: AO, harder: 'pull-up', photo: 'Wide-Grip_Lat_Pulldown',
    summary: 'Vertical pulling you can load precisely.',
    cues: ['Grip just outside the shoulders', 'Pull the bar to the upper chest', 'Lean back only slightly'], mistakes: ['Pulling behind the neck', 'Using momentum to swing the weight'] },
  { id: 'dumbbell-row', name: 'One-arm Dumbbell Row', pattern: 'row', primary: ['back'], secondary: ['biceps'], equipment: ['dumbbells', 'bench'], level: 'beginner', loaded: true, compound: true, audiences: AO, harder: 'barbell-row', photo: 'One-Arm_Dumbbell_Row',
    summary: 'Supported single-arm rowing for a strong, even back.',
    cues: ['One hand and knee on the bench', 'Pull the elbow toward the hip', 'Keep the torso still and square'], mistakes: ['Twisting to lift more', 'Shrugging the weight up'] },
  { id: 'barbell-row', name: 'Barbell Row', pattern: 'row', primary: ['back'], secondary: ['biceps', 'hamstrings'], equipment: ['barbell'], level: 'intermediate', loaded: true, compound: true, audiences: A, easier: 'dumbbell-row', photo: 'Bent_Over_Barbell_Row',
    summary: 'A heavy hinge-and-row for the whole back.',
    cues: ['Hinge to about 45 degrees, back flat', 'Row the bar to the lower ribs', 'Lower with control, keep the hinge'], mistakes: ['Standing up as the set gets hard', 'Jerking the bar with the hips'] },
  { id: 'inverted-row', name: 'Inverted Row', pattern: 'row', primary: ['back'], secondary: ['biceps', 'core'], equipment: ['pullup-bar'], level: 'beginner', compound: true, audiences: A, harder: 'pull-up', photo: 'Inverted_Row', photoNote: 'Shown under a bar set low in a rack; a low, sturdy bar works the same way.',
    summary: 'A bodyweight row under a low bar.',
    cues: ['Body straight from heels to head', 'Pull the chest to the bar', 'Squeeze the shoulder blades at the top'], mistakes: ['Hips dropping', 'Reaching with the chin'] },
  { id: 'cable-row', name: 'Seated Cable Row', pattern: 'row', primary: ['back'], secondary: ['biceps'], equipment: ['cable'], level: 'beginner', loaded: true, compound: true, audiences: AO, photo: 'Seated_Cable_Rows',
    summary: 'Smooth horizontal pulling with constant tension.',
    cues: ['Sit tall with a slight knee bend', 'Pull the handle to the belly button', 'Let the shoulders reach forward on the return'], mistakes: ['Rocking the torso back and forth', 'Rounding the lower back'] },
  { id: 'face-pull', name: 'Face Pull', pattern: 'row', primary: ['shoulders', 'back'], equipment: ['cable'], level: 'intermediate', loaded: true, audiences: A, photo: 'Face_Pull',
    summary: 'Rear-shoulder and rotator cuff work for healthy shoulders.',
    cues: ['Rope at face height, thumbs back', 'Pull toward the eyes, elbows high', 'Rotate the hands back at the finish'], mistakes: ['Using too much weight and leaning back', 'Elbows dropping below the hands'] },
  { id: 'dumbbell-curl', name: 'Dumbbell Curl', pattern: 'curl', primary: ['biceps'], equipment: ['dumbbells'], level: 'beginner', loaded: true, audiences: AO, photo: 'Dumbbell_Bicep_Curl',
    summary: 'Simple, effective elbow flexion.',
    cues: ['Elbows pinned at your sides', 'Turn the palms up as you curl', 'Lower for a slow count of two'], mistakes: ['Swinging the torso', 'Elbows drifting forward'] },
  { id: 'hammer-curl', name: 'Hammer Curl', pattern: 'curl', primary: ['biceps'], equipment: ['dumbbells'], level: 'beginner', loaded: true, audiences: AO, photo: 'Hammer_Curls',
    summary: 'Neutral-grip curls for the biceps and forearms.',
    cues: ['Thumbs up throughout', 'Curl without moving the upper arm', 'Squeeze briefly at the top'], mistakes: ['Rushing the lowering phase', 'Shrugging the shoulders'] },
  { id: 'farmer-carry', name: "Farmer's Walk", pattern: 'carry', primary: ['core'], secondary: ['back', 'shoulders'], equipment: ['dumbbells'], kind: 'time', level: 'beginner', loaded: true, compound: true, audiences: AO, photo: 'Farmers_Walk', photoNote: 'Shown with farmer’s-walk handles; heavy dumbbells work the same way.',
    summary: 'Walk tall with heavy weights for grip, trunk and posture.',
    cues: ['Stand tall, shoulders down and back', 'Short, quick steps', 'Grip hard; do not let the weights swing'], mistakes: ['Leaning to one side', 'Shrugging the shoulders'] },
  // ── Core ───────────────────────────────────────────────────────────────────
  { id: 'plank', name: 'Front Plank', pattern: 'plank', primary: ['core'], secondary: ['shoulders'], kind: 'time', level: 'beginner', audiences: ALL, harder: 'side-plank', photo: 'Plank',
    summary: 'Anti-extension core strength. Quality beats duration.',
    cues: ['Elbows under the shoulders', 'Squeeze the glutes and pull the ribs down', 'Breathe slowly through the hold'], mistakes: ['Hips sagging or piking', 'Holding your breath'] },
  { id: 'side-plank', name: 'Side Plank', pattern: 'plank', primary: ['core'], secondary: ['shoulders'], kind: 'time', level: 'beginner', audiences: AK, easier: 'plank', photo: 'Side_Bridge',
    summary: 'Side-on core stability for the obliques.',
    cues: ['Elbow under the shoulder', 'Hips high, body in one line', 'Switch sides halfway through the set'], mistakes: ['Hips dropping toward the floor', 'Rolling the chest forward'] },
  { id: 'dead-bug', name: 'Dead Bug', pattern: 'crunch', primary: ['core'], level: 'beginner', audiences: ALL, photo: 'Dead_Bug',
    summary: 'Controlled core work that keeps the lower back safe.',
    cues: ['Lower back pressed into the floor', 'Extend the opposite arm and leg slowly', 'Exhale fully as you reach'], mistakes: ['Lower back arching off the floor', 'Moving too fast'] },
  { id: 'crunch', name: 'Crunch', pattern: 'crunch', primary: ['core'], level: 'beginner', audiences: A, photo: 'Crunches',
    summary: 'Short-range trunk flexion for the abdominals.',
    cues: ['Knees bent, feet flat', 'Curl the ribs toward the hips', 'Keep the chin slightly tucked'], mistakes: ['Yanking on the neck', 'Using momentum'] },
  { id: 'flutter-kicks', name: 'Flutter Kicks', pattern: 'crunch', primary: ['core'], secondary: ['glutes'], kind: 'time', level: 'beginner', audiences: A, photo: 'Flutter_Kicks',
    summary: 'Alternating small kicks for core endurance.',
    cues: ['Lower back stays pressed down', 'Small, quick kicks', 'Raise the legs higher if the back lifts'], mistakes: ['Arching the lower back', 'Holding the breath'] },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', pattern: 'crunch', primary: ['core'], equipment: ['pullup-bar'], level: 'advanced', audiences: A, easier: 'dead-bug', photo: 'Hanging_Leg_Raise',
    summary: 'Lower-abdominal work from a hang. Bend the knees to make it easier.',
    cues: ['Start from a still dead hang', 'Curl the pelvis up as the legs rise', 'Lower without swinging'], mistakes: ['Swinging for momentum', 'Lifting only the thighs, not the pelvis'] },
  { id: 'cable-crunch', name: 'Cable Crunch', pattern: 'crunch', primary: ['core'], equipment: ['cable'], level: 'intermediate', loaded: true, audiences: A, photo: 'Cable_Crunch',
    summary: 'Loaded trunk flexion with a rope.',
    cues: ['Kneel with the rope beside the head', 'Crunch the ribs toward the pelvis', 'Hips stay still'], mistakes: ['Sitting back with the hips', 'Pulling with the arms'] },
  { id: 'mountain-climber', name: 'Mountain Climbers', pattern: 'cardio', primary: ['core', 'cardio'], secondary: ['shoulders'], kind: 'time', level: 'beginner', audiences: AK, photo: 'Mountain_Climbers',
    summary: 'Core and conditioning from a high plank.',
    cues: ['Hands under the shoulders', 'Drive the knees toward the chest', 'Keep the hips level'], mistakes: ['Hips bouncing high', 'Shoulders drifting behind the hands'] },
  // ── Calves ─────────────────────────────────────────────────────────────────
  { id: 'calf-raise', name: 'Machine Calf Raise', pattern: 'calf', primary: ['calves'], equipment: ['machines'], level: 'beginner', loaded: true, audiences: AO, photo: 'Standing_Calf_Raises',
    summary: 'Full-range calf work with the load on the shoulders.',
    cues: ['Balls of the feet on the platform', 'Rise as high as possible', 'Lower slowly into a full stretch'], mistakes: ['Bouncing at the bottom', 'Bending the knees to help'] },
  { id: 'band-calf-raise', name: 'Band Calf Raise', pattern: 'calf', primary: ['calves'], equipment: ['bands'], level: 'beginner', audiences: AO, photo: 'Calf_Raises_-_With_Bands',
    summary: 'Calf raises against band tension, easy to do at home.',
    cues: ['Band under the balls of the feet', 'Rise straight up onto the big toes', 'Pause at the top'], mistakes: ['Rolling onto the outer foot', 'Rushing the reps'] },
  { id: 'dumbbell-calf-raise', name: 'Seated Dumbbell Calf Raise', pattern: 'calf', primary: ['calves'], equipment: ['dumbbells', 'bench'], level: 'beginner', loaded: true, audiences: AO, photo: 'Dumbbell_Seated_One-Leg_Calf_Raise',
    summary: 'Seated calf work that targets the deeper calf muscle.',
    cues: ['Dumbbell resting on the knee', 'Toes on a small block or plate', 'Full stretch, then full rise'], mistakes: ['Short, bouncing reps', 'Too heavy to control'] },
  // ── Conditioning and play ──────────────────────────────────────────────────
  { id: 'treadmill-walk', name: 'Treadmill Walk', pattern: 'cardio', primary: ['cardio'], secondary: ['quads'], equipment: ['machines'], kind: 'time', level: 'beginner', audiences: AO, harder: 'treadmill-jog', photo: 'Walking_Treadmill',
    summary: 'Steady walking at a pace where you can still talk.',
    cues: ['Clip the safety key to your clothing', 'Start slow and build the pace gradually', 'Hold the rails only for balance'], mistakes: ['Gripping the rails and leaning back', 'Starting at full speed'] },
  { id: 'treadmill-jog', name: 'Treadmill Jog', pattern: 'cardio', primary: ['cardio'], secondary: ['quads', 'calves'], equipment: ['machines'], kind: 'time', level: 'beginner', audiences: A, easier: 'treadmill-walk', photo: 'Jogging_Treadmill',
    summary: 'Easy jogging to build aerobic fitness.',
    cues: ['Short, light strides', 'Stay near the front of the belt', 'Slow down if you cannot speak in sentences'], mistakes: ['Overstriding and heel-slamming', 'Looking down at the feet'] },
  { id: 'fast-skipping', name: 'Skipping Drill', pattern: 'cardio', primary: ['cardio'], secondary: ['calves', 'quads'], kind: 'time', level: 'beginner', audiences: AK, photo: 'Fast_Skipping',
    summary: 'Quick, light skips that build coordination and rhythm.',
    cues: ['Stay on the balls of the feet', 'Swing the arms in rhythm', 'Keep the steps light and quiet'], mistakes: ['Landing flat-footed', 'Leaning back'] },
  { id: 'butt-kicks', name: 'Butt Kicks', pattern: 'cardio', primary: ['cardio'], secondary: ['hamstrings'], kind: 'time', level: 'beginner', audiences: AK, photo: 'Double_Leg_Butt_Kick', photoNote: 'Shown as a jumping version; jogging in place and kicking the heels up is the gentler option.',
    summary: 'A lively warm-up that brings the heels toward the seat.',
    cues: ['Stay tall', 'Heels come up behind you', 'Land softly'], mistakes: ['Leaning forward', 'Stomping'] },
  { id: 'lateral-cone-hops', name: 'Lateral Cone Hops', pattern: 'cardio', primary: ['cardio'], secondary: ['calves', 'glutes'], kind: 'time', level: 'beginner', audiences: AK, photo: 'Lateral_Cone_Hops',
    summary: 'Side-to-side hops over a small marker for agility and balance. Cones or a line on the floor work.',
    cues: ['Feet together, soft knees', 'Hop just high enough to clear the marker', 'Land quietly on the balls of the feet'], mistakes: ['Landing with straight legs', 'Using a marker that is too high'] },
  { id: 'jump-squat', name: 'Jump Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['cardio'], level: 'intermediate', compound: true, audiences: AK, easier: 'bodyweight-squat', photo: 'Freehand_Jump_Squat',
    summary: 'An explosive squat that builds power.',
    cues: ['Squat to a comfortable depth', 'Jump straight up', 'Land softly and flow into the next rep'], mistakes: ['Landing on locked knees', 'Knees caving on landing'] },
  // ── Mobility ───────────────────────────────────────────────────────────────
  { id: 'cat-cow', name: 'Cat Stretch', pattern: 'mobility', primary: ['back'], secondary: ['core'], kind: 'time', level: 'beginner', audiences: ALL, photo: 'Cat_Stretch',
    summary: 'Gentle spinal mobility on hands and knees.',
    cues: ['Hands under shoulders, knees under hips', 'Round the spine, then let it gently sag', 'Match the movement to your breath'], mistakes: ['Moving only from the neck', 'Rushing'] },
  { id: 'hip-circles', name: 'Standing Hip Circles', pattern: 'mobility', primary: ['glutes'], kind: 'time', level: 'beginner', audiences: ALL, photo: 'Standing_Hip_Circles',
    summary: 'Loosens the hips before training. Hold a support if needed.',
    cues: ['Hands on the hips, feet hip-width', 'Draw slow, wide circles with the hips', 'Switch direction halfway'], mistakes: ['Moving the shoulders instead of the hips', 'Forcing the range'] },
  { id: 'ankle-circles', name: 'Ankle Circles', pattern: 'mobility', primary: ['calves'], kind: 'time', level: 'beginner', audiences: ALL, photo: 'Ankle_Circles',
    summary: 'Simple ankle mobility, seated or holding a support.',
    cues: ['Lift one foot slightly', 'Draw slow circles with the toes', 'Both directions on each foot'], mistakes: ['Rushing the circles', 'Balancing without support when unsteady'] },
  { id: 'chair-back-stretch', name: 'Seated Lower-back Stretch', pattern: 'mobility', primary: ['back'], kind: 'time', level: 'beginner', audiences: AO, photo: 'Chair_Lower_Back_Stretch',
    summary: 'A supported side and lower-back stretch.',
    cues: ['Sit tall, feet flat', 'Reach one arm overhead and lean gently', 'Breathe slowly; no bouncing'], mistakes: ['Collapsing forward', 'Pushing into pain'] },
  { id: 'calf-stretch', name: 'Wall Calf Stretch', pattern: 'mobility', primary: ['calves'], kind: 'time', level: 'beginner', audiences: ALL, photo: 'Calf_Stretch_Hands_Against_Wall',
    summary: 'A classic calf stretch with the wall for support.',
    cues: ['Hands on the wall, one foot back', 'Back heel stays down', 'Lean in until you feel a gentle stretch'], mistakes: ['Lifting the back heel', 'Bouncing'] },
  { id: 'toe-touches', name: 'Standing Toe Touch', pattern: 'mobility', primary: ['hamstrings'], secondary: ['back'], kind: 'time', level: 'beginner', audiences: AK, photo: 'Standing_Toe_Touches',
    summary: 'A gentle hamstring stretch. Reach only as far as is comfortable.',
    cues: ['Soft knees', 'Hinge forward slowly', 'Let the arms hang and breathe'], mistakes: ['Bouncing toward the floor', 'Locking the knees hard'] },
];

const SAFETY: Partial<Record<Pattern, string>> = {
  squat: 'Use a depth you can control without pain. Under a barbell, set the rack safeties just below your lowest position.',
  hinge: 'Keep the spine neutral; reduce the range or load if your lower back rounds. Stop if you feel sharp back pain.',
  lunge: 'Use a wall or rail for balance if you are unsteady. Shorten the step if the front knee aches.',
  'push-floor': 'Raise the hands on a bench or wall if full push-ups strain the shoulders or wrists.',
  'press-bench': 'Use a spotter or safety arms for heavy barbell work. Lower under control; never bounce the weight.',
  'press-overhead': 'Press only through a range that is pain-free for your shoulders. Keep the ribs down so the lower back does not arch.',
  'pull-vertical': 'Lower all the way under control; dropping into the bottom stresses the shoulders.',
  row: 'Keep the back flat. Support the chest or one hand if your lower back tires.',
  plank: 'Stop the hold when your form breaks, not when the timer ends.',
  crunch: 'Keep the lower back in contact with the floor; stop if you feel strain in the neck or back.',
  cardio: 'Build intensity gradually. Stop and seek help if you feel chest pain, dizziness or unusual breathlessness.',
  mobility: 'Move slowly and stay within a comfortable range. Stretching should never hurt.',
  carry: 'Pick the weights up and set them down with a flat back, bending at the knees and hips.',
};

export const EXERCISES: Exercise[] = DEFS.map(def => ({
  id: def.id, name: def.name, pattern: def.pattern, primary: def.primary, secondary: def.secondary ?? [], equipment: def.equipment ?? [], level: def.level,
  kind: def.kind ?? 'reps', loaded: def.loaded ?? false, compound: def.compound ?? false, summary: def.summary, cues: def.cues, mistakes: def.mistakes,
  photo: def.photo, photoNote: def.photoNote, audiences: def.audiences ?? ['adults'], easier: def.easier, harder: def.harder,
}));

const BY_ID = new Map(EXERCISES.map(exercise => [exercise.id, exercise]));
// Exercises replaced in this catalog. Saved plans and history that still reference them keep working.
const LEGACY: Record<string, string> = {
  'reverse-lunge': 'walking-lunge', 'pike-push-up': 'overhead-press', 'band-press': 'overhead-press', 'band-pulldown': 'lat-pulldown', 'band-row': 'band-back-fly',
  'doorway-row': 'inverted-row', 'band-curl': 'dumbbell-curl', 'diamond-push-up': 'close-grip-push-up', 'prone-y-raise': 'band-pull-apart', 'jumping-jack': 'fast-skipping',
  'high-knees': 'fast-skipping', burpee: 'jump-squat', 'kettlebell-carry': 'farmer-carry', 'worlds-greatest-stretch': 'hip-circles', 'wall-sit': 'bodyweight-squat',
  'hanging-knee-raise': 'hanging-leg-raise',
};

export function exerciseById(id: string): Exercise | undefined {
  return BY_ID.get(id) ?? BY_ID.get(LEGACY[id] ?? '');
}

export function instructionsFor(exercise: Exercise): string[] {
  return INSTRUCTIONS[exercise.photo] ?? [];
}

export function safetyFor(exercise: Exercise): string {
  return SAFETY[exercise.pattern] ?? 'Move with control and stop if anything hurts.';
}

export function photoFor(exercise: Exercise | string, frame: 0 | 1 = 0): string {
  const value = typeof exercise === 'string' ? exerciseById(exercise) : exercise;
  return value ? `/web/media/exercises/${value.photo}-${frame}.webp` : '';
}

const LEVEL_RANK: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };
export function levelAllows(user: Level, exercise: Level) {
  return LEVEL_RANK[exercise] <= LEVEL_RANK[user];
}

export function available(exercise: Exercise, equipment: readonly Equipment[]) {
  return exercise.equipment.every(item => item === 'bodyweight' || equipment.includes(item));
}

export function suitableFor(exercise: Exercise, audience: Audience) {
  return exercise.audiences.includes(audience);
}

/** Alternatives that train the same thing and fit the user's equipment, closest match first. */
export function substitutes(id: string, equipment: readonly Equipment[], level: Level = 'advanced', audience?: Audience): Exercise[] {
  const source = exerciseById(id);
  if (!source) return [];
  const score = (candidate: Exercise) =>
    (candidate.pattern === source.pattern ? 4 : 0) +
    candidate.primary.filter(muscle => source.primary.includes(muscle)).length * 2 +
    (candidate.kind === source.kind ? 1 : 0);
  return EXERCISES
    .filter(candidate => candidate.id !== source.id && available(candidate, equipment) && levelAllows(level, candidate.level) && (!audience || suitableFor(candidate, audience)))
    .map(candidate => ({ candidate, value: score(candidate) }))
    .filter(entry => entry.value >= 3)
    .sort((a, b) => b.value - a.value || a.candidate.name.localeCompare(b.candidate.name))
    .map(entry => entry.candidate);
}

/** Loose name matching used to map coach-written exercise names onto the catalog. */
export function findExercise(name: string): Exercise | undefined {
  const clean = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(dumbbell|barbell|standing|seated)\b/g, ' ').replace(/s\b/g, '').replace(/\s+/g, ' ').trim();
  const target = clean(name);
  if (!target) return undefined;
  if (BY_ID.has(target.replace(/ /g, '-'))) return BY_ID.get(target.replace(/ /g, '-'));
  return EXERCISES.find(exercise => clean(exercise.name) === target)
    ?? EXERCISES.find(exercise => target.includes(clean(exercise.name)) || clean(exercise.name).includes(target));
}

/** Library categories. An exercise can appear in several. */
export const CATEGORIES = [
  { id: 'chest', label: 'Chest', test: (e: Exercise) => e.primary.includes('chest') },
  { id: 'back', label: 'Back', test: (e: Exercise) => e.primary.includes('back') },
  { id: 'shoulders', label: 'Shoulders', test: (e: Exercise) => e.primary.includes('shoulders') },
  { id: 'arms', label: 'Arms', test: (e: Exercise) => e.primary.includes('biceps') || e.primary.includes('triceps') },
  { id: 'legs', label: 'Legs', test: (e: Exercise) => e.primary.some(m => m === 'quads' || m === 'hamstrings' || m === 'calves') },
  { id: 'glutes', label: 'Glutes', test: (e: Exercise) => e.primary.includes('glutes') },
  { id: 'core', label: 'Core', test: (e: Exercise) => e.primary.includes('core') },
  { id: 'full-body', label: 'Full body', test: (e: Exercise) => e.compound && new Set([...e.primary, ...e.secondary]).size >= 3 },
  { id: 'cardio', label: 'Cardio', test: (e: Exercise) => e.pattern === 'cardio' },
  { id: 'mobility', label: 'Mobility & flexibility', test: (e: Exercise) => e.pattern === 'mobility' },
  { id: 'bodyweight', label: 'Bodyweight', test: (e: Exercise) => e.equipment.length === 0 },
  { id: 'equipment', label: 'With equipment', test: (e: Exercise) => e.equipment.length > 0 },
  { id: 'kids', label: 'Kids activities', test: (e: Exercise) => e.audiences.includes('kids') },
  { id: 'older', label: 'Older adults', test: (e: Exercise) => e.audiences.includes('older') },
] as const;
export type CategoryId = typeof CATEGORIES[number]['id'];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', quads: 'Quads',
  hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', core: 'Core', cardio: 'Conditioning',
};
export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  bodyweight: 'Bodyweight', dumbbells: 'Dumbbells', barbell: 'Barbell & rack', kettlebell: 'Kettlebell', bench: 'Bench',
  'pullup-bar': 'Pull-up bar', bands: 'Resistance bands', cable: 'Cable station', machines: 'Machines',
};
