import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, readConfig } from '../dist/server/app.js';
import { RequestStore } from '../dist/server/marketplace/requests.js';
import { AUDIENCE_INFO, PARTICIPANT_AGE_BANDS, allowsMealPlans, requiresGuardian } from '../dist/shared/audience.js';
import { EXERCISES, exerciseById, instructionsFor, suitableFor } from '../dist/shared/fitness/exercises.js';
import { generatePlan, recommendedSplit, splitsFor } from '../dist/shared/fitness/programs.js';
import { coarse, distanceKm, resolvePlace } from '../dist/shared/marketplace/geo.js';
import { COMPARE_LIMIT, coarseLocation, emptyLocal, readLocal, toggleCompare, toggleSaved } from '../dist/shared/marketplace/local.js';
import { effectiveMonthly, packageQuote, paymentSchedule, savingVsMonthly, totalDue } from '../dist/shared/marketplace/pricing.js';
import { emptyRequest, isRequestInput, validateRequest } from '../dist/shared/marketplace/requests.js';
import { EMPTY_QUERY, parseGymQuery, searchGyms, serializeGymQuery } from '../dist/shared/marketplace/search.js';

const load = name => JSON.parse(readFileSync(new URL(`../data/demo/${name}.json`, import.meta.url), 'utf8')).items;
const cities = load('cities'), gyms = load('gyms'), pros = load('professionals'), packages = load('packages');
const gym = id => gyms.find(item => item.id === id);
const future = days => { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); };

// ── Demonstration data ───────────────────────────────────────────────────────────────────────

test('demo data is labelled, internally consistent and makes no unverifiable claims', () => {
  assert.equal(gyms.length, 16);
  for (const item of gyms) {
    assert.equal(item.demo, true, `${item.id} must be labelled as demo`);
    assert.equal(item.reviews, null, `${item.id} must not carry invented reviews`);
    assert.match(item.address, /Demonstration listing/);
    assert(cities.some(city => city.id === item.cityId));
    for (const image of item.images) {
      assert(existsSync(new URL(`../src/web/static${image.src.replace('/web', '')}`, import.meta.url)), `${image.src} exists`);
      assert.match(image.caption, /Not a photo of this gym/);
      assert(image.alt.length > 5);
    }
    for (const plan of item.memberships) {
      assert(plan.audiences.every(audience => item.audiences.includes(audience)), `${item.id}/${plan.id} audience is offered by the gym`);
      assert(plan.price > 0 && Number.isInteger(plan.months));
      if (plan.offer) assert.match(plan.offer.validUntil, /^\d{4}-\d{2}-\d{2}$/);
    }
    for (const id of [...item.trainerIds, ...item.nutritionistIds]) assert(pros.some(pro => pro.id === id), `${id} exists`);
  }
  for (const pro of pros) {
    assert.equal(pro.demo, true);
    assert(pro.qualifications.every(item => item.verified === false), `${pro.id} qualifications are not claimed as verified`);
    assert.match(pro.bio, /Demonstration profile/);
  }
  // Every requested duration is offered somewhere.
  for (const months of [1, 2, 3, 6, 9, 10]) assert(gyms.some(item => item.memberships.some(plan => plan.months === months)), `${months}-month plans exist`);
});

test('children never get nutrition consultations, meal plans or adult-only programmes', () => {
  for (const pack of packages.filter(item => item.audiences.includes('kids'))) {
    assert.equal(pack.nutritionConsults, 0);
    assert.equal(pack.mealPlanning, false);
    assert.deepEqual(pack.formats, ['in-person']);
  }
  assert.equal(requiresGuardian('kids'), true);
  assert.equal(allowsMealPlans('kids'), false);
  assert.deepEqual(splitsFor('kids').map(split => split.id), ['play-move-3']);
  assert.equal(recommendedSplit(5, 'advanced', 'kids'), 'play-move-3');
  const plan = generatePlan({ split: 'play-move-3', level: 'beginner', goal: 'general', equipment: ['bodyweight'], minutes: 30, audience: 'kids' });
  for (const day of plan.days) for (const item of day.exercises) {
    assert(suitableFor(exerciseById(item.exerciseId), 'kids'), `${item.exerciseId} is suitable for kids`);
    assert(item.sets <= 2);
  }
});

test('older adults get balance and mobility programmes with moderate volume', () => {
  assert.equal(recommendedSplit(3, 'beginner', 'older'), 'active-ageing-3');
  const plan = generatePlan({ split: 'active-ageing-3', level: 'beginner', goal: 'general', equipment: ['bodyweight', 'dumbbells'], minutes: 45, audience: 'older' });
  const items = plan.days.flatMap(day => day.exercises);
  assert(items.length > 0);
  for (const item of items) {
    assert(suitableFor(exerciseById(item.exerciseId), 'older'), item.exerciseId);
    if (item.reps) assert(item.reps >= 8, 'no heavy low-rep work');
  }
  assert.equal(AUDIENCE_INFO.older.ages, 'Ages 65+');
  assert.deepEqual(PARTICIPANT_AGE_BANDS.older, ['65–74', '75–84', '85+']);
});

test('every exercise has a two-frame photo demonstration and step-by-step instructions', () => {
  assert(EXERCISES.length >= 70);
  for (const exercise of EXERCISES) {
    for (const frame of [0, 1]) assert(existsSync(new URL(`../src/web/static/media/exercises/${exercise.photo}-${frame}.webp`, import.meta.url)), `${exercise.id} frame ${frame}`);
    assert(instructionsFor(exercise).length > 0, `${exercise.id} has instructions`);
    assert(exercise.audiences.length > 0);
    for (const id of [exercise.easier, exercise.harder].filter(Boolean)) assert(exerciseById(id), `${exercise.id} variation ${id} exists`);
  }
});

// ── Pricing ──────────────────────────────────────────────────────────────────────────────────

test('membership prices: effective monthly, totals and savings only from the gym’s own prices', () => {
  const forge = gym('forge-athletic-club');
  const monthly = forge.memberships.find(plan => plan.months === 1);
  const ten = forge.memberships.find(plan => plan.months === 10);
  assert.equal(effectiveMonthly(ten), Math.round((ten.price / 10) * 100) / 100);
  assert.deepEqual(totalDue(ten), { membership: ten.price, joiningFee: ten.joiningFee, deposit: ten.deposit, total: ten.price + ten.joiningFee + ten.deposit });
  const saving = savingVsMonthly(forge, ten);
  assert.equal(saving.amount, monthly.price * 10 - ten.price);
  assert.equal(savingVsMonthly(forge, monthly), null, 'no saving on the baseline itself');
  // Without a one-month plan there is nothing to compare with, so no discount is shown.
  assert.equal(savingVsMonthly({ ...forge, memberships: [ten] }, ten), null);
  // A longer plan that is not actually cheaper never shows a saving.
  assert.equal(savingVsMonthly(forge, { ...ten, price: monthly.price * 11 }), null);
  assert.match(paymentSchedule(monthly, 'INR'), /paid at the start/);
  assert.match(paymentSchedule({ ...ten, billing: 'monthly' }, 'INR'), /^10 monthly payments of/);
});

test('package quotes are built from listed rates and need the whole team', () => {
  const pack = packages.find(item => item.id === 'complete-transformation');
  const trainer = pros.find(item => item.role === 'trainer');
  const nutritionist = pros.find(item => item.role === 'nutritionist' && item.mealPlanFee);
  assert.equal(packageQuote(pack, trainer, null), null);
  assert.equal(packageQuote(pack, null, nutritionist), null);
  const quote = packageQuote(pack, trainer, nutritionist);
  const months = Math.round(pack.weeks / 4);
  assert.equal(quote.total, pack.trainingSessions * trainer.rate + pack.nutritionConsults * nutritionist.rate + months * nutritionist.mealPlanFee);
  assert.match(quote.note, /confirms the final price/);
});

// ── Search and location ──────────────────────────────────────────────────────────────────────

test('gym search filters by audience, budget, duration, facilities, verified reviews and distance', () => {
  const query = parseGymQuery(new URLSearchParams('audience=adults&max=3000&months=10&facilities=pool,nonsense&lat=12.97&lng=77.64&sort=distance&radius=bogus'));
  assert.deepEqual(query.facilities, ['pool']);
  assert.equal(query.radiusKm, null, 'invalid values are dropped, not trusted');
  const results = searchGyms(gyms, query);
  for (const result of results) {
    assert(result.gym.audiences.includes('adults'));
    assert(result.gym.facilities.includes('pool'));
    assert.equal(result.from.plan.months, 10);
    assert(result.from.monthly <= 3000);
  }
  const near = searchGyms(gyms, { ...EMPTY_QUERY, near: { lat: 12.97, lng: 77.64 } });
  assert(near.every((item, i) => i === 0 || item.distanceKm >= near[i - 1].distanceKm), 'sorted nearest first');
  assert.equal(searchGyms(gyms, { ...EMPTY_QUERY, reviewed: true }).length, 0, 'no demo gym claims verified reviews');
  const kids = searchGyms(gyms, { ...EMPTY_QUERY, audience: 'kids' });
  assert(kids.length > 0 && kids.every(item => item.from.plan.audiences.includes('kids')));
  assert.equal(serializeGymQuery(parseGymQuery(new URLSearchParams('q=forge&early=1'))).toString(), 'q=forge&early=1');
});

test('places resolve from names and postcodes; positions are coarsened', () => {
  assert.equal(resolvePlace('Indiranagar', cities)[0].label, 'Indiranagar, Bengaluru');
  assert.equal(resolvePlace('mumbai', cities)[0].cityId, 'mumbai');
  const postcode = cities[0].areas[0].postcodes[0];
  assert.equal(resolvePlace(postcode, cities)[0].cityId, cities[0].id);
  assert.deepEqual(resolvePlace('Atlantis', cities), []);
  assert.deepEqual(coarse({ lat: 12.971599, lng: 77.594566 }), { lat: 12.97, lng: 77.59 });
  assert(distanceKm({ lat: 12.97, lng: 77.59 }, { lat: 19.07, lng: 72.87 }) > 800);
});

// ── Requests ─────────────────────────────────────────────────────────────────────────────────

const membership = (overrides = {}) => ({ ...emptyRequest('membership', 'adults'), gymId: 'forge-athletic-club', planId: '10m',
  contact: { name: 'Asha Rao', email: 'asha@example.com', phone: '', preferred: 'email' }, consent: { privacy: true, contact: true }, ...overrides });

test('request validation: strict structure, field errors and guardian rules for children', () => {
  assert(isRequestInput(membership()));
  assert(!isRequestInput({ ...membership(), price: 1 }), 'unknown keys are rejected');
  assert(!isRequestInput({ ...membership(), gymId: '<script>' }));
  assert.deepEqual(validateRequest(membership()), {});
  const bad = validateRequest(membership({ contact: { name: 'A', email: 'nope', phone: 'abc', preferred: 'phone' }, consent: { privacy: false, contact: false }, preferredDates: ['2001-01-01'] }));
  assert.deepEqual(Object.keys(bad).sort(), ['consent.contact', 'consent.privacy', 'contact.email', 'contact.name', 'contact.phone', 'preferredDates']);
  const child = { ...emptyRequest('coaching', 'kids'), packageId: 'young-athlete', format: 'in-person', contact: { name: 'Parent Name', email: 'p@example.com', phone: '', preferred: 'email' }, consent: { privacy: true, contact: true } };
  const errors = validateRequest(child);
  assert(errors['guardian.consent'] && errors['guardian.relationship'] && errors.participantAgeBand);
  assert.deepEqual(validateRequest({ ...child, guardian: { relationship: 'Parent', consent: true }, participantAgeBand: '8–10', preferredDates: [future(3)] }), {});
});

test('local state survives damage field by field and keeps location coarse', () => {
  const state = readLocal({ version: 1, audience: 'older', saved: { gyms: ['a', 'a', '<bad>'], exercises: 'nope' }, compare: [{ gymId: 'x', planId: '1m' }, { bad: true }], nutrition: { diet: 'vegan', avoid: ['nuts', 'glass'], meals: [{ id: 'm_1', day: 9, slot: 'lunch', text: 'x' }] } });
  assert.equal(state.audience, 'older');
  assert.deepEqual(state.saved.gyms, ['a']);
  assert.deepEqual(state.saved.exercises, []);
  assert.equal(state.compare.length, 1);
  assert.deepEqual(state.nutrition.avoid, ['nuts']);
  assert.deepEqual(state.nutrition.meals, []);
  assert.deepEqual(readLocal('garbage'), emptyLocal());
  let full = emptyLocal();
  for (let i = 0; i < COMPARE_LIMIT; i++) full = toggleCompare(full, { gymId: `g${i}`, planId: '1m' });
  assert.equal(toggleCompare(full, { gymId: 'extra', planId: '1m' }), null);
  assert.equal(toggleCompare(full, { gymId: 'g0', planId: '1m' }).compare.length, COMPARE_LIMIT - 1);
  assert.deepEqual(toggleSaved(toggleSaved(emptyLocal(), 'gyms', 'x'), 'gyms', 'x').saved.gyms, []);
  assert.deepEqual(coarseLocation({ lat: 12.345678, lng: 77.987654, label: 'Here', cityId: null, source: 'device' }), { lat: 12.35, lng: 77.99, label: 'Here', cityId: null, source: 'device' });
});

// ── HTTP API ─────────────────────────────────────────────────────────────────────────────────

async function app(env = {}, deps = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'icarus-'));
  const server = createApp(readConfig({ PORT: '0', DATA_DIR: dir, ...env }, process.cwd()), deps);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const cfg = await (await fetch(`${url}/api/config`)).json();
  return { url, cfg, dir, close: async () => { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); } };
}
const send = (a, data, headers = {}) => fetch(`${a.url}/api/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Icarus-Token': a.cfg.token, ...headers }, body: JSON.stringify(data) });

test('marketplace read endpoints: listings, detail, professionals and geocoding', async () => {
  const a = await app();
  try {
    const info = await (await fetch(`${a.url}/api/marketplace`)).json();
    assert.equal(info.provider.demo, true);
    assert.equal(info.cities.length, 4);
    assert.equal(a.cfg.marketplace.demo, true);
    assert.equal(a.cfg.map, null, 'no map unless a tile server is configured');
    const list = await (await fetch(`${a.url}/api/gyms?audience=older&city=delhi`)).json();
    assert(list.total > 0 && list.results.every(item => item.gym.audiences.includes('older') && item.gym.cityId === 'delhi'));
    assert.equal(list.results[0].gym.policies, undefined, 'list results are trimmed');
    const detail = await (await fetch(`${a.url}/api/gyms/forge-athletic-club`)).json();
    assert.equal(detail.gym.name, 'Forge Athletic Club');
    assert(detail.trainers.length > 0);
    assert.equal((await fetch(`${a.url}/api/gyms/not-a-gym`)).status, 404);
    const nutritionists = await (await fetch(`${a.url}/api/professionals?role=nutritionist&city=mumbai`)).json();
    assert(nutritionists.results.every(pro => pro.role === 'nutritionist' && pro.cityId === 'mumbai'));
    const places = await (await fetch(`${a.url}/api/geocode?q=Koramangala`)).json();
    assert.equal(places.results[0].label, 'Koramangala, Bengaluru');
  } finally { await a.close(); }
});

test('membership request: token required, server-side quote, received status, check and withdraw', async () => {
  const a = await app();
  try {
    assert.equal((await send(a, membership(), { 'X-Icarus-Token': 'wrong' })).status, 403);
    assert.equal((await send(a, membership(), { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await send(a, { ...membership(), price: 1 })).status, 400);
    const invalid = await send(a, membership({ contact: { name: '', email: 'x', phone: '', preferred: 'email' } }));
    assert.equal(invalid.status, 422);
    assert((await invalid.json()).fields['contact.email']);
    assert.equal((await send(a, membership({ planId: 'nope' }))).status, 409);

    const response = await send(a, membership());
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.match(created.ref, /^ICR-\d{6}-[0-9A-F]{6}$/);
    assert.equal(created.status, 'received', 'never reported as confirmed');
    const plan = gym('forge-athletic-club').memberships.find(item => item.id === '10m');
    assert.equal(created.quote.total, plan.price + plan.joiningFee + plan.deposit, 'price comes from the listing, not the client');

    const stored = await readFile(join(a.dir, 'requests.jsonl'), 'utf8');
    assert(!stored.includes(created.token), 'only a hash of the access token is stored');

    const headers = { 'X-Request-Token': created.token };
    assert.equal((await (await fetch(`${a.url}/api/requests/${created.ref}`, { headers })).json()).status, 'received');
    assert.equal((await fetch(`${a.url}/api/requests/${created.ref}`, { headers: { 'X-Request-Token': 'x'.repeat(32) } })).status, 404);
    const withdrawn = await fetch(`${a.url}/api/requests/${created.ref}`, { method: 'DELETE', headers: { ...headers, 'X-Icarus-Token': a.cfg.token } });
    assert.equal((await withdrawn.json()).status, 'withdrawn');
    assert(!(await readFile(join(a.dir, 'requests.jsonl'), 'utf8')).includes('asha@example.com'), 'contact details are erased on withdrawal');
  } finally { await a.close(); }
});

test('coaching request: team, format, area and audience rules are enforced by the server', async () => {
  const a = await app();
  try {
    const trainer = pros.find(pro => pro.role === 'trainer' && pro.cityId === 'bengaluru' && pro.audiences.includes('adults'));
    const nutritionist = pros.find(pro => pro.role === 'nutritionist' && pro.cityId === 'bengaluru' && pro.audiences.includes('adults'));
    const base = { ...emptyRequest('coaching', 'adults'), packageId: 'complete-transformation', format: 'online', preferredDates: [future(5)],
      contact: { name: 'Dev Shah', email: 'dev@example.com', phone: '', preferred: 'email' }, consent: { privacy: true, contact: true } };
    const missingTeam = await (await send(a, base)).json();
    assert(missingTeam.fields.trainerId && missingTeam.fields.nutritionistId);
    assert((await (await send(a, { ...base, trainerId: trainer.id, nutritionistId: nutritionist.id, format: 'in-person' })).json()).fields.area);
    const ok = await send(a, { ...base, trainerId: trainer.id, nutritionistId: nutritionist.id });
    assert.equal(ok.status, 201);
    const record = await ok.json();
    assert.equal(record.quote.total, packageQuote(packages.find(item => item.id === 'complete-transformation'), trainer, nutritionist).total);
    // Children: adult packages are refused and a guardian is required.
    const kid = await (await send(a, { ...base, audience: 'kids', guardian: null, trainerId: trainer.id, nutritionistId: nutritionist.id })).json();
    assert(kid.fields.packageId && kid.fields['guardian.consent']);
  } finally { await a.close(); }
});

test('requests: honeypot, rate limit and optional forwarding', async () => {
  const forwarded = [];
  const a = await app({ REQUEST_WEBHOOK_URL: 'https://hooks.example/requests' }, { webhookFetch: async (url, init) => { forwarded.push({ url, body: JSON.parse(init.body) }); return new Response('{}', { status: 200 }); } });
  try {
    assert.equal(a.cfg.requestsForwarded, true);
    const bot = await send(a, membership({ website: 'http://spam.example' }));
    assert.equal(bot.status, 202);
    assert.equal(forwarded.length, 0, 'bot submissions are not stored or forwarded');
    const first = await (await send(a, membership())).json();
    assert.equal(first.status, 'forwarded');
    assert.equal(forwarded[0].url, 'https://hooks.example/requests');
    assert.equal(forwarded[0].body.ref, first.ref);
    let last;
    for (let i = 0; i < 10; i++) last = await send(a, membership());
    assert.equal(last.status, 429, 'more than ten requests in ten minutes are refused');
  } finally { await a.close(); }
});

test('request store drops expired records on start', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'icarus-store-'));
  try {
    const old = { ref: 'ICR-200101-ABCDEF', kind: 'support', status: 'received', createdAt: '2020-01-01T00:00:00Z', summary: 'old', quote: null, forwarded: false, tokenHash: 'x', input: {}, expiresAt: '2020-04-01T00:00:00Z' };
    await writeFile(join(dir, 'requests.jsonl'), JSON.stringify(old) + '\nnot json\n');
    const store = new RequestStore(dir, 90, null);
    assert.equal(await store.count(), 0);
    assert.equal((await readFile(join(dir, 'requests.jsonl'), 'utf8')).trim(), '');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('headers allow location only for this site and serve photos with caching', async () => {
  const a = await app({ MAP_TILE_URL: 'https://tiles.example.com/{z}/{x}/{y}.png', MAP_ATTRIBUTION: '© Example' });
  try {
    const page = await fetch(`${a.url}/`);
    assert.match(page.headers.get('permissions-policy'), /geolocation=\(self\)/);
    assert.match(page.headers.get('content-security-policy'), /img-src 'self' data: https:\/\/tiles\.example\.com;/);
    assert.deepEqual(a.cfg.map, { tileUrl: 'https://tiles.example.com/{z}/{x}/{y}.png', attribution: '© Example' });
    const photo = await fetch(`${a.url}/web/media/exercises/Goblet_Squat-0.webp`);
    assert.equal(photo.status, 200);
    assert.equal(photo.headers.get('content-type'), 'image/webp');
    assert.match(photo.headers.get('cache-control'), /max-age/);
  } finally { await a.close(); }
  const insecure = readConfig({ MAP_TILE_URL: 'http://tiles.example.com/{z}/{x}/{y}.png' }, process.cwd());
  assert.equal(insecure.map, null);
  assert(insecure.warnings.some(item => item.includes('MAP_TILE_URL')));
});
