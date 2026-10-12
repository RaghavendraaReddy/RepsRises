# AiRA workout starter: Aira's training session

## Quick start

Requires Node.js 22.18 or later. From this folder, run one command:

```sh
npm ci --ignore-scripts && npm start
```

Open http://127.0.0.1:4319 and tap **I'm new, go easy** (or say hi). No key or account is needed:
Mock plays a scripted Aira. Aira does the moves; you're her coach and run the clock. A short tour shows on the first
visit, then one tip at a time points at the next button. Tap the dark button when
there is one (**Next: Arm Circles →**, **Start the clock**, then **Next: …** once the clock ends, or
**Finish early** to skip ahead) until **See how we did →** shows the report.

To run Aira on a live model, enable ClaudeCLI or OpenAIAPI as described in
[docs/RUNTIMES.md](docs/RUNTIMES.md). On Windows, ClaudeCLI also needs `CLI_ALLOW_WINDOWS=true` in
`.env`. What I built, why, and which runtime modes I tested are in [docs/SUBMISSION.md](docs/SUBMISSION.md).

---

A local browser harness derived from AiRA API and AiRA client code. Read the short assignment in [docs/EXERCISE.md](docs/EXERCISE.md).

## Run

Requires Node.js 22.18 or later and npm. From this directory:

```sh
npm ci --ignore-scripts
npm start
```

Open http://127.0.0.1:4319. Stop with Ctrl+C. Change `PORT` in a local `.env` if needed.

The app starts in Mock and needs no account or key. Mock plays a scripted Aira for ordinary messages; it does not call a model or read the skill. **Load wiring sample** (in Builder tools, or `/demo`) still displays the generic component examples, with `next`, `back` and `change value to 6`. Use your editor to change files. Prompt/skill edits load on the next request; source changes need a restart and browser reload.

## Files

- `skills/workout.md`: your interaction instructions.
- `prompts/`: output protocol and current-turn context.
- `src/shared/openui/`: parser, component registry, validation, navigation, timers and serialization.
- `src/web/`: browser renderers and presentation.
- `src/server/`: prompt loading, local HTTP server, mock and model adapters.
- `examples/wiring.openui`: generic offline fixture.

See [AiRA harness](docs/HARNESS.md) for the included plumbing and [runtime setup](docs/RUNTIMES.md) for optional model adapters.

## Check and package

```sh
npm run check
npx playwright install chromium
npm run test:ui
npm run package
```

The browser checks start a mock server on port 4320. To use an installed Chrome instead, set `PLAYWRIGHT_CHROME_PATH` to its absolute executable path.

Packaging writes `output/workout-source.zip` locally. It includes source and records changes against this starter's baseline; it excludes `.env`, dependencies, build output and repository history. It does not submit anything. Builder tools can export a local run; optional run JSON files can be placed in `runs/`. Keep credentials out of source and exports.

The supplied tests exercise local harness behavior with fake transports. ClaudeCLI was run live for this submission (see docs/SUBMISSION.md); OpenAIAPI was not. This browser slice is not the production AiRA application.
