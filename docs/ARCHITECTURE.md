# Architecture

Icarus is a TypeScript app with no front-end framework and no bundler. `tsc` compiles `src/` to ES modules in `dist/`; the browser loads them directly. A small Node HTTP server serves the built files and proxies coach requests.

```
src/
  shared/                 Runs in the browser and on the server
    fitness/
      types.ts            Domain types (profile, plan, session, workout)
      exercises.ts        Exercise catalog: patterns, muscles, equipment, cues, mistakes, substitutions
      programs.ts         Plan templates, prescriptions by level and goal, time fitting
      session.ts          Workout engine: pure, timestamp-based, testable
      stats.ts            Streaks, weekly and monthly summaries, personal bests, units
      storage.ts          Repository over a key-value store, with validation and import/export
    coach/
      contracts.ts        Request/reply schema, product limits, reply normalisation
      offline.ts          Built-in rule-based coach
    schema.ts             Small JSON-schema validator and provider-facing schema
    redact.ts             Credential redaction for anything returned to the browser
  server/
    main.ts, app.ts       HTTP server, security headers, host/origin/token checks, rate limits
    config.ts             Environment parsing and provider availability
    prompt.ts             Loads prompts/system.md + skills/workout.md + catalog
    providers/            anthropic.ts, openai.ts, claude-cli.ts, codex-cli.ts, cli-common.ts
    subprocess.ts         Shell-free child process runner with output caps and timeouts
  web/
    main.ts               Shell, routes, background timer settling
    core/                 DOM builder, router, store, API client, sound/vibration cues
    ui/                   Components, icons, brand art, animated exercise figures
    views/                One file per screen
    styles/               tokens, base, components, views, motion (concatenated at build)
```

## Key decisions

- **Typed workouts instead of a screen language.** The previous starter had the model emit a declarative screen language that trusted code rendered. Icarus needs data it can execute (sets, reps, rest, loads), so the coach now returns a validated workout object and the app renders everything itself. Model output never becomes markup: all text is inserted with `textContent`, and `scripts/lint.mjs` bans `innerHTML` and similar APIs.
- **Timestamp-based timers.** Rest and hold timers store an end time, not a counter. Pausing stores the remaining time. On every tick, on returning to the tab and on reload, `settle()` applies timers that ended while the app was away. Timers stay correct across screen changes, background tabs and reloads.
- **One store, validated persistence.** `AppStore` (browser) wraps `Repository` (shared). Every write is validated; every read is validated and bad records are skipped and reported, never "fixed" silently. Workouts are de-duplicated by id, so a double tap or two tabs finishing together cannot create two entries. Other tabs are kept in sync through the `storage` event.
- **Storage behind an interface.** `Repository` takes any `KeyValueStore`. A server-backed implementation can replace `localStorage` without touching screens. Accounts and sync are intentionally not implemented.
- **Providers behind one function.** Each adapter takes the same request and returns the same validated reply, so screens do not know which provider answered.

## Security model

- Binds to `127.0.0.1` by default. Binding elsewhere requires `ALLOWED_HOSTS`; the server checks the `Host` and `Origin` headers on every request and rejects cross-site fetches.
- A random per-process token must accompany coach requests. It blocks cross-site form posts; it is **not** user authentication.
- Static files come from an allow-list of `dist/web` and `dist/shared` paths only; source, `.env`, prompts and skills are never served.
- Strict Content Security Policy (`default-src 'self'`, no inline scripts), `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, and a restrictive `Permissions-Policy`.
- AI requests are rate limited per client address and capped at four in flight. Request bodies are limited to 256 KB.
- Provider errors are mapped to friendly messages; raw provider output and keys are never returned, and replies pass through credential redaction.
- CLI providers run without a shell, with the prompt on stdin, a minimal environment, an empty working directory, output limits, timeouts and a tool-use tripwire.
