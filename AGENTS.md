# Working on Icarus

Read README.md, docs/ARCHITECTURE.md and docs/DESIGN.md first.

- Domain logic belongs in `src/shared/fitness` and stays pure and unit-tested. Screens call `store` actions; they do not write to storage directly.
- Never insert model or user text as HTML. Build DOM with `h()` from `src/web/core/dom.ts`; `npm run lint` enforces this.
- Coach replies must pass `checkReply` in `src/shared/coach/contracts.ts`. Change the schema there, then update `prompts/system.md`.
- Use design tokens from `src/web/styles/tokens.css`; components read only the semantic variables (`--bg`, `--fg`, `--line`, `--accent`, `--signal`).
- Keep credentials in `.env`. Never log message content or keys, and never send keys to the browser.
- Keep the safeguards: loopback by default, host/origin/token checks, static allow-list, no tools for CLI providers.
- After changes run `npm run check` and `npm run test:ui`. Report which AI providers were actually exercised.
