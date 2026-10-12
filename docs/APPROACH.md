# Approach

How the changes on top of the starter are built, and why. What changed for the user, and the evidence,
are in [SUBMISSION.md](SUBMISSION.md).

## High Level Approach

**Goal:** a first-timer always knows what to do now, why, and what's next, and the coach feels like a
character rather than a manual.

**The idea: flip the roles.** The protocol (`prompts/system.md`, untouched) forbids telling the user
to exercise, and my v1 coach kept refusing because of it. So **Aira, a tiny cartoon in training, does
every move, and the user is her coach and runs the clock.** A request for shoulders becomes *Aira's
Shoulder Day*; a time limit is a ceiling; pain gets "check with a doctor". She never tells the user to
do a move.

**Who owns what:**
- **The model** writes the words and the screen data: declarative OpenUI statements, never code.
- **Trusted local code** owns everything that has to be instant or correct: navigation, the progress
  tally, the clock, when Aira's lines play, the failure banner, the tour and the tips.
- **Mock mirrors the live skill,** because reviewers run Mock first and without a key.

**Order of work:** role and first screen → one flow with one main button → failure banner → Beats
(timed lines) → avatar → final pass (rename to Aira, plain move names, tour, tips). Each step was
tested before the next one started.

## Low Level Approach

| Layer | Files | What it does |
|---|---|---|
| Behaviour | `skills/workout.md` | Screen naming contract (`s0_*` plan, `mK_*` per move, `end`, `sum_*` report), a sizing table (4×40 s default, 3×30 new, 3×20 tired, 5×50 challenge), honesty rules (never claim a change that wasn't made), Beats rules, medical and off-topic handling. |
| Mock | `src/server/coach-script.ts` (new) | Scripted Aira that uses the same statement names as the skill. It handles the 3 starter buttons, body-part themes, time limits, shorter / harder / skip, the report, medical and off-topic messages. |
| Registry and validation | `openui-library.ts`, `validate.ts` | Two new components: `Progress(label)` and `Beats(going, halfway?, done?, waiting?)`. Each Beats line must be non-empty and at most 140 characters. |
| Tolerance | `document.ts` (`tolerateBeats`), `controller.ts` | Before validation, drops malformed `*_beats` statements and references to Beats that were never written. Everything else still goes through full validation. Dropped names are recorded as builder-only notes in exports. |
| Retry fix | `controller.ts` | Re-sending the same message after a failed turn now sends it again. A double tap while a reply is pending is still ignored. |
| Renderers | `components.ts` | Timer labels match the role (Start the clock / Pause / Resume / Finish early, "YOU RUN THE CLOCK"), "Move K of N · X done" progress, follow-up chips, Beats kept hidden as data. |
| App shell | `app.ts`, `index.html`, `styles.css`, `dom.ts` | See the list below. |
| Windows CLI opt-in | `cli.ts`, `.env.example` | `CLI_ALLOW_WINDOWS=false` by default. When enabled, the child process still gets a minimal environment with no keys, tokens or proxies. The POSIX writable-bits check is skipped on Windows only, because Windows reports synthetic mode bits. |

**App shell details**
- **One filled button per moment.** Next is primary only when the screen has no timer, its timer is
  done, or it's the last screen. On the last screen, Next sends the first follow-up ("See how we
  did"). Starting the workout is now local navigation instead of a 12–15 s AI round trip.
- **"Aira says"** (avatar + line) is moved directly under the move title. Her line follows the
  timer: arrival, clock started, half time, done, and "waiting" if the clock hasn't started 20 s
  after landing on the move.
- **Avatar:** an SVG built node by node with `createElementNS`, with CSS moods. The lint bans
  `innerHTML` and `eval`, so markup is never built from strings.
- **Failure banner:** Aira's line first, the technical reason in small type, then **Try again**. The
  clock and Next keep working. A local guard (for example, sending while on a break) is explained,
  not shown as a failure.
- **Tour (3 steps) and tips (4, one at a time):** each bubble sits beside, above or below its
  target, never on it. State is kept in localStorage (`aira-tour-seen`, `aira-tips-off`,
  `aira-tips-done`) with every read and write in try/catch, so a blocked storage just shows the tour
  again. Footer links: "Show tour again" and "Hide tips". No new libraries.

## Tradeoffs

| Choice | Gain | Cost |
|---|---|---|
| Aira does real, everyday moves | Familiar names, a clear role, no refusals | A judgement call against the protocol. It's held by the skill rule "never tell the user to do a move" and by tests. The earlier invented space moves were clearer for the protocol but confusing for people. |
| The AI writes Beats once per move; local code plays them | No AI call per timer tick: instant, cheap, no mid-move waiting | Lines can only react to 4 timer phases, not to anything else. |
| Local Next instead of an AI turn | 12–15 s becomes instant | Aira doesn't comment on every tap. |
| Mock as a hand-kept copy of the skill | Reviewers get the real experience with no key | Two sources can drift. Unit tests pin Mock's behaviour, but nothing checks it against the skill automatically. |
| Beats are optional | A bad line never breaks a screen | A missing line is silent to the user; it only shows in exports. |
| Tour and tips | A first-timer is never lost | More on screen. Kept to one bubble at a time; each goes for good once pressed; "Hide tips" turns them off. |
| Kept the 4 slips from the 28-turn live round documented, not fixed and re-run | Stable evidence | The final pass then changed the copy, so the final skill has only one live message. |
| Windows CLI opt-in | Live testing on my machine | Relaxes one starter check, on Windows only and off by default. |

**Not built, on purpose:** real exercise instructions, audio or voice, an AI turn per timer, rest
screens, automatic retries, accounts.

## Test Coverage Approach

Tests are layered from cheapest to closest to a real user.

1. **Static checks:** `npm run check` runs the typecheck, the lint (no `innerHTML`, no `eval`, no
   trailing whitespace) and the unit tests.
2. **Unit tests** (`tests/core.test.mjs`): 44 tests; **40 pass**. The 4 failures are Windows-only and
   also fail on the untouched starter. The new and reworked tests cover:
   - Mock honouring the starter buttons, body-part themes and time limits, and never opening with a
     refusal;
   - Mock only saying true things about lightening, the last move, skips and the report;
   - early finishes and a bonus move that lands before the finish line;
   - Beats being optional: valid ones apply, while malformed or unwritten ones are dropped and the
     rest still renders;
   - a re-send after a failed turn going out, while a double tap during a pending reply is ignored;
   - no leftover space words or the old character name in Mock copy.
3. **Browser tests** (`tests/browser/app.spec.mjs`, Playwright on installed Chrome): **19/19 pass.**
   The new ones cover:
   - the role flip on the first screen;
   - a full Mock session with one filled button per moment and no duplicate actions;
   - a local guard not being treated as a failure;
   - Aira's lines arriving at the right timer moments;
   - a timer tap not cancelling a slow reply;
   - "Aira says" placed under the title;
   - the tour and tips at 1366 px and 390 px, checking that a tip never overlaps its button or the
     timer readout;
   - Hide tips and Show tips.
4. **Fault modes in Mock** (slow, invalid schema, failed request): the failure line shows, the screen
   and clock keep working, and Try again recovers.
5. **Live ClaudeCLI runs, exported to `runs/`:**
   - an earlier version: 28 turns over 8 scenarios, plus a forced failure;
   - the final skill: one message.
6. **Fresh unzip:** `npm run package`, unzip into an empty folder, `npm ci --ignore-scripts`,
   `npm start`, then a full first-visit Mock run. This finished with 0 console errors.

**Gaps:**
- OpenAIAPI was not run (no key), and CodexCLI is blocked by the starter.
- The final skill has had one live message, not a full round.
- Browser tests ran on Chrome only, with phone width emulated rather than on a real device.
- No real first-time users have tried it yet.

## Scalability Approach

This is a local, single-user harness. Here, scaling means adding content and behaviour safely,
keeping cost and latency flat, and knowing what would change for real users.

- **Content:**
  - A new body-part theme is one data entry in Mock plus a line in the skill.
  - A different voice is a change to copy only.
  - The screen naming contract doesn't change, so the renderers don't either.
- **Behaviour:** new behaviour follows the path Progress and Beats took: registry entry → prop
  validator → trusted renderer. The model can only ever send data, never code.
- **Cost and latency:**
  - One AI turn plans the whole session, with Beats included. Navigation, the clock and the timed
    lines are local, so cost grows with the number of conversations, not with time spent working out.
  - Named statements persist between turns, so a follow-up can patch one statement instead of
    resending the whole screen.
  - The existing caps (12 screens, 40,000 characters, 58 messages per run) bound each payload.
- **Drift between Mock and the skill:** the next step is a scripted eval that replays fixed scenarios
  against the live skill whenever it changes. Exports already record the skill hash, so each result is
  tied to a version.
- **Real users (not built):**
  - Conversation state lives in the browser tab, and the server is a stateless relay per turn, so
    scaling the server side is straightforward.
  - It would need a session store, so a workout survives a reload or a device change.
  - Streaming the first reply, and caching the opening for the 3 starter buttons, would cut the
    15–30 s first wait.
  - It would also need rate limits per provider, and anonymous events showing where first-timers
    stop.
