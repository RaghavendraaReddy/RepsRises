import type { IncomingMessage, ServerResponse } from 'node:http';
import { requiresGuardian } from '../../shared/audience.js';
import { resolvePlace } from '../../shared/marketplace/geo.js';
import { money, packageQuote, totalDue } from '../../shared/marketplace/pricing.js';
import { isRequestInput, validateRequest, type RequestInput } from '../../shared/marketplace/requests.js';
import { parseGymQuery, searchGyms } from '../../shared/marketplace/search.js';
import type { Gym, PackageTemplate, Professional, Quote } from '../../shared/marketplace/types.js';
import { PublicError } from '../errors.js';
import type { MarketplaceProvider } from './provider.js';
import type { RequestStore } from './requests.js';

export type Respond = (res: ServerResponse, status: number, value: unknown) => void;
type Context = { provider: MarketplaceProvider; requests: RequestStore; respond: Respond; readBody: (req: IncomingMessage) => Promise<unknown>; allowRequest: (req: IncomingMessage) => boolean };

const REF = /^ICR-\d{6}-[0-9A-F]{6}$/;

/** A trimmed gym for result lists. The full record is returned by the detail endpoint. */
function card(gym: Gym) {
  const { description: _d, policies: _p, equipment: _e, ...rest } = gym;
  return { ...rest, images: gym.images.slice(0, 1) };
}

function summarise(input: RequestInput, gym: Gym | undefined, pack: PackageTemplate | undefined, trainer: Professional | undefined, nutritionist: Professional | undefined): string {
  if (input.kind === 'membership') return `Membership enquiry: ${gym?.memberships.find(plan => plan.id === input.planId)?.name ?? 'plan'} at ${gym?.name}`;
  if (input.kind === 'coaching') return `Coaching request: ${pack?.name}${trainer ? ` with ${trainer.name}` : ''}${nutritionist ? ` and ${nutritionist.name}` : ''}`;
  if (input.kind === 'support') return 'Support request';
  return `Enquiry to ${gym?.name ?? trainer?.name ?? nutritionist?.name}`;
}

/** Handles marketplace endpoints. Returns false when the path is not one of them. */
export async function handleMarketplace(req: IncomingMessage, res: ServerResponse, path: string, url: URL, ctx: Context): Promise<boolean> {
  const { provider, respond } = ctx;
  if (req.method === 'GET' && path === '/api/marketplace') {
    const [cities, packages] = await Promise.all([provider.cities(), provider.packages()]);
    respond(res, 200, { provider: { name: provider.name, demo: provider.demo }, cities, packages });
    return true;
  }
  if (req.method === 'GET' && path === '/api/gyms') {
    const results = searchGyms(await provider.gyms(), parseGymQuery(url.searchParams));
    respond(res, 200, { total: results.length, results: results.map(result => ({ ...result, gym: card(result.gym) })) });
    return true;
  }
  const gymMatch = path.match(/^\/api\/gyms\/([a-z0-9-]+)$/);
  if (req.method === 'GET' && gymMatch) {
    const [gyms, pros] = await Promise.all([provider.gyms(), provider.professionals()]);
    const gym = gyms.find(item => item.id === gymMatch[1]);
    if (!gym) throw new PublicError('NOT_FOUND', 'That gym was not found.', 404);
    respond(res, 200, { gym, trainers: pros.filter(p => gym.trainerIds.includes(p.id)), nutritionists: pros.filter(p => gym.nutritionistIds.includes(p.id)) });
    return true;
  }
  if (req.method === 'GET' && path === '/api/professionals') {
    const role = url.searchParams.get('role'), city = url.searchParams.get('city'), audience = url.searchParams.get('audience'), gymId = url.searchParams.get('gym');
    const list = (await provider.professionals()).filter(p => (!role || p.role === role) && (!city || p.cityId === city) && (!audience || p.audiences.includes(audience as never)) && (!gymId || p.gymIds.includes(gymId)));
    respond(res, 200, { results: list });
    return true;
  }
  const proMatch = path.match(/^\/api\/professionals\/([a-z0-9-]+)$/);
  if (req.method === 'GET' && proMatch) {
    const [pros, gyms] = await Promise.all([provider.professionals(), provider.gyms()]);
    const professional = pros.find(item => item.id === proMatch[1]);
    if (!professional) throw new PublicError('NOT_FOUND', 'That professional was not found.', 404);
    respond(res, 200, { professional, gyms: gyms.filter(g => professional.gymIds.includes(g.id)).map(card) });
    return true;
  }
  if (req.method === 'GET' && path === '/api/geocode') {
    const q = (url.searchParams.get('q') ?? '').slice(0, 80);
    respond(res, 200, { source: provider.demo ? 'Built-in place list for demonstration cities' : 'Gazetteer', results: resolvePlace(q, await provider.cities()) });
    return true;
  }
  if (req.method === 'POST' && path === '/api/requests') {
    if (!ctx.allowRequest(req)) throw new PublicError('RATE_LIMIT', 'Too many requests from this device. Please wait a few minutes.', 429);
    const input = await ctx.readBody(req);
    if (!isRequestInput(input)) throw new PublicError('INPUT', 'The form could not be read. Reload the page and try again.', 400);
    // Honeypot: bots fill hidden fields. Answer as if accepted, store nothing.
    if (input.website.trim()) { respond(res, 202, { ignored: true }); return true; }
    const errors = validateRequest(input);
    const [gyms, pros, packages] = await Promise.all([provider.gyms(), provider.professionals(), provider.packages()]);
    const gym = input.gymId ? gyms.find(item => item.id === input.gymId) : undefined;
    const plan = gym && input.planId ? gym.memberships.find(item => item.id === input.planId) : undefined;
    const pack = input.packageId ? packages.find(item => item.id === input.packageId) : undefined;
    const trainer = input.trainerId ? pros.find(item => item.id === input.trainerId && item.role === 'trainer') : undefined;
    const nutritionist = input.nutritionistId ? pros.find(item => item.id === input.nutritionistId && item.role === 'nutritionist') : undefined;
    if ((input.gymId && !gym) || (input.planId && !plan) || (input.packageId && !pack) || (input.trainerId && !trainer) || (input.nutritionistId && !nutritionist))
      throw new PublicError('NOT_FOUND', 'Something you selected is no longer available. Please choose again.', 409);
    // Audience rules are enforced here as well as in the interface.
    if (plan && !plan.audiences.includes(input.audience)) errors.planId = 'That membership is not offered to this age group.';
    if (pack && !pack.audiences.includes(input.audience)) errors.packageId = 'That package is not offered to this age group.';
    for (const pro of [trainer, nutritionist]) if (pro && !pro.audiences.includes(input.audience)) errors.packageId = `${pro.name} does not work with this age group.`;
    if (pack && pack.trainingSessions && !trainer) errors.trainerId = 'Choose a trainer for this package.';
    if (pack && pack.nutritionConsults && !nutritionist) errors.nutritionistId = 'Choose a nutritionist for this package.';
    if (input.format && pack && !pack.formats.includes(input.format)) errors.format = 'That format is not available for this package.';
    for (const pro of [trainer, nutritionist]) if (pro && input.format && !pro.formats.includes(input.format)) errors.format = `${pro.name} does not offer that format.`;
    if (input.kind === 'coaching' && input.format && input.format !== 'online' && !input.area) errors.area = 'Choose the area where you would like to train.';
    if (input.area && trainer && input.format !== 'online' && ![...trainer.areas, ...(nutritionist?.areas ?? [])].includes(input.area)) errors.area = 'Choose an area your team works in.';
    if (requiresGuardian(input.audience) && input.guardian === null) errors['guardian.consent'] = 'Guardian consent is required for a child’s booking.';
    if (Object.keys(errors).length) { respond(res, 422, { error: 'Please check the highlighted fields.', fields: errors }); return true; }
    let quote: Quote | null = null;
    if (gym && plan) {
      const due = totalDue(plan);
      quote = { currency: gym.currency, total: due.total, note: 'Prices as listed by the gym. The gym confirms the final amount before you pay.',
        lines: [{ label: `${plan.name} membership`, amount: due.membership }, ...(due.joiningFee ? [{ label: 'Joining fee', amount: due.joiningFee }] : []), ...(due.deposit ? [{ label: 'Refundable deposit', amount: due.deposit }] : [])] };
    }
    if (pack) quote = packageQuote(pack, trainer ?? null, nutritionist ?? null);
    const created = await ctx.requests.create(input, summarise(input, gym, pack, trainer, nutritionist) + (quote ? ` · ${money(quote.total, quote.currency)}` : ''), quote);
    respond(res, 201, created);
    return true;
  }
  const requestMatch = path.match(/^\/api\/requests\/([A-Z0-9-]+)$/);
  if (requestMatch && (req.method === 'GET' || req.method === 'DELETE')) {
    const token = String(req.headers['x-request-token'] ?? '');
    if (!REF.test(requestMatch[1]) || token.length < 20 || token.length > 64) throw new PublicError('NOT_FOUND', 'Request not found.', 404);
    const record = req.method === 'GET' ? await ctx.requests.get(requestMatch[1], token) : await ctx.requests.withdraw(requestMatch[1], token);
    if (!record) throw new PublicError('NOT_FOUND', 'Request not found.', 404);
    respond(res, 200, record);
    return true;
  }
  return false;
}
