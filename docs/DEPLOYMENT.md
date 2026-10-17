# Deployment

Icarus runs as one Node process. This guide covers running it on a server, what it stores, and what to connect before real people use it.

## Production build and run

```sh
npm ci
npm run build                     # fonts, TypeScript and photos are build-time inputs
NODE_ENV=production node --env-file=.env dist/server/main.js
```

Run it under a process manager (systemd, a container supervisor) that restarts it on failure.

1. Put it behind an HTTPS reverse proxy. Set `HOST=127.0.0.1` when the proxy is on the same machine, or `HOST=0.0.0.0` with `ALLOWED_HOSTS=your.domain`. Set `TRUST_PROXY=1` only when a trusted proxy sets `X-Forwarded-For`.
2. Set `DATA_DIR` to a persistent directory owned by the service user (for example `/var/lib/icarus`). It is created with mode `0700`; files inside with `0600`. Back it up like any personal data, and include it in your deletion process.
3. Set `SUPPORT_EMAIL`, and optionally `REQUEST_WEBHOOK_URL`, `MAP_TILE_URL` and `MAP_ATTRIBUTION`.
4. `GET /api/health` returns `{ "ok": true }` for health checks.
5. Restart daily (or after changing `.env`) so expired requests are purged on start.

Security headers, CSP and rate limits are built in; your proxy should add HSTS.

**There is no user authentication.** Anyone who can reach the server can submit requests (rate limited) and use its AI providers on your account (rate limited). For a public deployment, either leave AI keys unset so only the offline coach runs, or put the coach behind an authenticating proxy. Never enable the CLI providers on a shared or public server.

## Storage today

| What | Where | Format |
|---|---|---|
| Listings | `data/demo/*.json` (read-only) | `{ notice, generated, items }`, validated on load |
| Requests | `DATA_DIR/requests.jsonl` | One JSON object per line; rewritten on start and on withdrawal |
| Everything per person | The person's browser | `localStorage` keys `icarus.v1.*`, validated on read |

No database is required for the demonstration. There are no migrations to run.

## Moving to a database

When listings and requests move to a database, keep the two boundaries the code already has:

- **Listings:** implement `MarketplaceProvider` (`src/server/marketplace/provider.ts`) over your tables and return it from `createProvider`. Records from a verified source set `demo: false`.
- **Requests:** replace `RequestStore` (`src/server/marketplace/requests.ts`) with the same three methods (`create`, `get`, `withdraw`) and a scheduled job that deletes expired rows.

A starting schema (PostgreSQL), not used by this build:

```sql
-- 001_initial.sql
create table gyms (
  id text primary key, name text not null, city_id text not null, area text not null,
  address text not null, lat numeric(8,5) not null, lng numeric(8,5) not null,
  data jsonb not null,                          -- facilities, classes, hours, policies, images
  verified_at timestamptz,                      -- when the listing was checked with the business
  updated_at timestamptz not null default now()
);
create table membership_plans (
  gym_id text references gyms(id) on delete cascade, id text, months int not null check (months > 0),
  price numeric(12,2) not null, joining_fee numeric(12,2) not null default 0, deposit numeric(12,2) not null default 0,
  billing text not null check (billing in ('upfront','monthly')), audiences text[] not null, terms jsonb not null,
  offer jsonb, primary key (gym_id, id)
);
create table professionals (
  id text primary key, role text not null check (role in ('trainer','nutritionist')), name text not null,
  city_id text not null, rate numeric(12,2) not null, meal_plan_fee numeric(12,2), data jsonb not null
);
create table qualifications (
  professional_id text references professionals(id) on delete cascade, name text not null, issuer text not null,
  verified_at timestamptz, evidence_ref text     -- verified only when checked with the issuer
);
create table requests (
  ref text primary key, kind text not null, status text not null check (status in ('received','forwarded','withdrawn')),
  token_hash char(64) not null, summary text not null, quote jsonb, input jsonb not null,
  created_at timestamptz not null default now(), expires_at timestamptz not null
);
create index requests_expiry on requests (expires_at);
```

Keep `status` limited to states Icarus can know. If you integrate a booking system that confirms places, add `confirmed` only when that system reports it.

## External services

| Need | What to connect | Setting |
|---|---|---|
| Real gyms and professionals | Your database or a partner directory API | `MarketplaceProvider` |
| Requests reaching providers | CRM, ticketing or booking system webhook (HTTPS, JSON body with `ref`, `kind`, `summary`, `quote`, `createdAt`, `request`) | `REQUEST_WEBHOOK_URL` |
| Street maps | A tile provider whose terms allow your traffic | `MAP_TILE_URL`, `MAP_ATTRIBUTION` |
| Place search beyond the bundled areas | A geocoding service called from the server (add it behind `/api/geocode`) | code change |
| Verified reviews | A review platform with verified purchases or visits | populate `gym.reviews` |
| Payments | A payment provider, only together with confirmed bookings, refunds and receipts | not implemented |
| Accounts | An identity provider (OIDC) or your own auth with server-side sessions | not implemented |
| AI coach | Anthropic or OpenAI API keys | see [AI_PROVIDERS.md](AI_PROVIDERS.md) |

## Before launch checklist

- [ ] Demo data replaced; no record shows `demo: true` in production, or the demo banner stays.
- [ ] Gym photographs licensed from each venue; captions updated.
- [ ] Qualification checks done with issuers before anything shows "Verified".
- [ ] Webhook or booking system receiving requests, with someone responsible for replying.
- [ ] Privacy notice, terms and child-safety process reviewed by a lawyer for each country you operate in.
- [ ] Support email monitored.
- [ ] Backups and deletion of `DATA_DIR` covered by your retention policy.
- [ ] `npm run check` and `npm run test:ui` pass on the release build.
