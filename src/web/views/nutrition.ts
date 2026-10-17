import { allowsMealPlans } from '../../shared/audience.js';
import { AVOIDS, AVOID_LABEL, DIETS, DIET_LABEL, MEAL_LIMIT, MEAL_SLOTS, MEAL_SLOT_LABEL, type Avoid, type Diet, type MealSlot } from '../../shared/marketplace/local.js';
import { uid } from '../../shared/fitness/programs.js';
import { h, replace } from '../core/dom.js';
import { load, market } from '../core/market.js';
import type { View } from '../core/router.js';
import { store } from '../core/store.js';
import { button, eyebrow, linkButton, toast } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { audienceSwitch, notice, proCard, sectionHead } from '../ui/market-ui.js';
import { STATUS_TEXT } from './request.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** General, widely agreed principles. Written as education, never as an individual prescription. */
const TOPICS: { title: string; points: string[]; audiences?: ('kids' | 'adults' | 'older')[] }[] = [
  { title: 'Build meals around whole foods', points: ['Fill half the plate with vegetables and fruit, a quarter with whole grains, and a quarter with a protein food.', 'Choose whole grains such as brown rice, millets, oats and whole-wheat roti more often than refined ones.'] },
  { title: 'Protein through the day', points: ['Spread protein across meals rather than saving it for dinner.', 'Vegetarian sources include dals, chana, rajma, paneer, curd, tofu, soy and milk. Eggs, fish and chicken are options for those who eat them.'] },
  { title: 'Water and training', points: ['Drink regularly through the day and around training, more in hot weather.', 'Plain water is enough for most sessions under an hour.'] },
  { title: 'Children eat for growth', audiences: ['kids'], points: ['Children need regular meals and snacks for growth and play. They should not follow weight-loss diets or calorie targets.', 'Offer a variety of foods, involve them in preparing meals, and limit sugary drinks.'] },
  { title: 'Protein and strength in later life', audiences: ['older'], points: ['Appetite can fall with age while protein needs stay the same or rise. Include a protein food at each meal.', 'Calcium and vitamin D matter for bones; ask your doctor whether you need a supplement.'] },
];

export function nutritionView(): View {
  const audience = store.audience();
  const meals = allowsMealPlans(audience);
  const nutrition = structuredClone(store.local.nutrition);

  const save = () => { try { store.saveNutrition(nutrition); } catch (error) { toast(error instanceof Error ? error.message : 'Could not save.', { kind: 'error' }); } };

  const prefs = h('form', { class: 'stack', style: { '--stack': '18px' }, onsubmit: (event: Event) => { event.preventDefault(); save(); toast('Dietary preferences saved on this device.'); } },
    h('div', { class: 'field' }, h('label', { for: 'diet' }, 'Eating pattern'), h('select', { id: 'diet', class: 'input select', onchange: (event: Event) => { nutrition.diet = (event.target as HTMLSelectElement).value as Diet; } },
      DIETS.map(item => h('option', { value: item, selected: nutrition.diet === item }, DIET_LABEL[item])))),
    h('fieldset', { class: 'field' }, h('legend', { class: 'label' }, 'Foods to avoid'), h('p', { class: 'hint' }, 'For allergies or intolerances, always tell your nutritionist and check labels.'),
      h('div', { class: 'check-grid' }, AVOIDS.map(item => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: nutrition.avoid.includes(item), onchange: (event: Event) => {
        nutrition.avoid = (event.target as HTMLInputElement).checked ? [...nutrition.avoid, item] : nutrition.avoid.filter(entry => entry !== item) as Avoid[];
      } }), AVOID_LABEL[item])))),
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary small' }, 'Save preferences')),
    h('p', { class: 'small muted' }, 'Kept only in this browser. Share them with your nutritionist when you book.'));

  const organiser = h('div', { class: 'organiser' });
  const drawOrganiser = () => {
    replace(organiser, h('div', { class: 'organiser-grid' }, DAYS.map((day, index) => h('section', { class: 'organiser-day', 'aria-labelledby': `day-${index}` },
      h('h3', { class: 'eyebrow', id: `day-${index}` }, day),
      MEAL_SLOTS.map(slot => {
        const entries = nutrition.meals.filter(meal => meal.day === index && meal.slot === slot);
        const inputId = `meal-${index}-${slot}`;
        return h('div', { class: 'organiser-slot' }, h('p', { class: 'tag' }, MEAL_SLOT_LABEL[slot]),
          h('ul', { role: 'list' }, entries.map(entry => h('li', null, h('span', null, entry.text), h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove ${entry.text} from ${day} ${MEAL_SLOT_LABEL[slot]}`, onclick: () => {
            nutrition.meals = nutrition.meals.filter(meal => meal.id !== entry.id); save(); drawOrganiser();
          } }, icon('close'))))),
          h('form', { class: 'organiser-add', onsubmit: (event: Event) => {
            event.preventDefault();
            const field = (event.currentTarget as HTMLFormElement).querySelector('input')!;
            const text = field.value.trim();
            if (!text) return;
            if (nutrition.meals.length >= MEAL_LIMIT) { toast('The organiser is full. Remove something first.', { kind: 'error' }); return; }
            nutrition.meals.push({ id: uid('meal'), day: index, slot: slot as MealSlot, text: text.slice(0, 140) }); save(); drawOrganiser();
            document.getElementById(inputId)?.focus();
          } }, h('label', { class: 'sr-only', for: inputId }, `Add to ${day} ${MEAL_SLOT_LABEL[slot]}`), h('input', { id: inputId, class: 'input small', maxlength: 140, placeholder: 'Add' })));
      })))),
    nutrition.meals.length ? h('div', { class: 'row' }, button('Clear the week', () => { nutrition.meals = []; save(); drawOrganiser(); }, { variant: 'ghost', size: 'small', icon: 'trash' })) : null);
  };
  if (meals) drawOrganiser();

  const nutritionists = h('div', { class: 'pro-grid' });
  const cityId = store.local.location?.cityId ?? 'bengaluru';
  void load(nutritionists, () => market.professionals({ role: 'nutritionist', city: cityId, audience }), data => data.results.length ? data.results.map(pro => proCard(pro))
    : [h('p', { class: 'muted' }, audience === 'kids' ? 'Nutrition consultations are not offered for children through Icarus. Speak to your child’s doctor or a registered paediatric dietitian.' : 'No nutritionists listed in this city yet.')]);

  const requests = store.local.requests.filter(item => item.kind === 'coaching' || item.kind === 'enquiry');
  const history = requests.length ? h('ul', { class: 'list', role: 'list' }, requests.map(item => h('li', null, h('a', { class: 'list-row', href: `#/requests/${item.ref}` },
    h('span', { class: 'stack', style: { '--stack': '2px' } }, h('span', { class: 'list-title' }, item.summary), h('span', { class: 'list-meta' }, `${item.ref} · ${new Date(item.createdAt).toLocaleDateString()} · ${STATUS_TEXT[item.status].label}`)), icon('chevron')))))
    : h('p', { class: 'small muted' }, 'No consultation requests from this device yet.');

  const el = h('div', { class: 'page surface-light nutrition' }, h('div', { class: 'container stack', style: { '--stack': '56px' } },
    h('header', { class: 'page-head' }, eyebrow('Nutrition'), h('h1', { class: 'display' }, 'Eat for the life ', h('em', null, 'you train for.')),
      h('p', { class: 'lead' }, 'General education, your own meal organiser, and qualified nutritionists for personal advice. Two different things, clearly kept apart.'), h('div', { class: 'row' }, audienceSwitch())),
    h('div', { class: 'two-up' },
      notice([h('strong', null, 'General information. '), 'Everything on this page is general education for healthy people. It is not personal advice, and it is not a diagnosis or treatment for any condition.'], 'info'),
      notice([h('strong', null, 'Personalised advice. '), 'Comes only from the nutritionist you book, after they have assessed you. If you have diabetes, kidney or heart disease, are pregnant, or take regular medication, see your doctor or a registered dietitian.'], 'safety')),
    notice([h('strong', null, 'If food, weight or eating feels out of control, '), 'please talk to a doctor or an eating-disorder service near you before following any meal plan or diet. Icarus does not offer calorie targets or weight-loss plans to children.'], 'warn'),
    h('section', { class: 'stack', 'aria-labelledby': 'edu' }, sectionHead({ eyebrow: 'Learn', title: 'Principles worth knowing', id: 'edu' }),
      h('div', { class: 'topic-grid' }, TOPICS.filter(topic => !topic.audiences || topic.audiences.includes(audience)).map(topic => h('article', { class: 'topic-card' }, h('h3', { class: 'title' }, topic.title), h('ul', { role: 'list', class: 'feature-list small' }, topic.points.map(point => h('li', null, icon('check'), point))))))),
    h('section', { class: 'split', 'aria-labelledby': 'prefs' }, h('div', { class: 'stack' }, sectionHead({ eyebrow: 'Preferences', title: 'Your dietary preferences', id: 'prefs' })), prefs),
    meals ? h('section', { class: 'stack', 'aria-labelledby': 'org' }, sectionHead({ eyebrow: 'Organiser', title: 'Your week of meals', id: 'org', lead: 'A place to plan your own meals, or note what your nutritionist recommends. Icarus does not generate meal plans.' }), organiser)
      : h('section', { class: 'stack' }, sectionHead({ eyebrow: 'Organiser', title: 'Meal organiser' }), notice('The meal organiser is for adults. Family meals for children are best planned with your child’s doctor or a registered paediatric dietitian.', 'info')),
    h('section', { class: 'stack', 'aria-labelledby': 'nut' }, sectionHead({ eyebrow: 'Nutritionists', title: 'Personal advice from a professional', id: 'nut', action: audience !== 'kids' ? linkButton('Trainer + nutritionist packages', '#/coaching', { variant: 'ghost', iconAfter: 'arrow' }) : null }), nutritionists),
    h('section', { class: 'stack', 'aria-labelledby': 'hist' }, sectionHead({ eyebrow: 'History', title: 'Your consultation requests', id: 'hist' }), history)));
  return { el, title: 'Nutrition', surface: 'light', nav: 'nutrition' };
}
