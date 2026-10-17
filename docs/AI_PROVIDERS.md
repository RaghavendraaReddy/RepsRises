# AI providers

Icarus always has a coach. **Icarus Offline** is built in: rule-based, deterministic and free, it builds sessions from the same generator as the plan builder, recommends splits, explains technique and suggests swaps. AI providers add open-ended conversation.

A provider turns on as soon as its configuration is present in `.env` (restart the server after editing). There is no separate opt-in flag. The coach screen lists every provider; ones that are not configured are shown as "not set up" with instructions. The browser remembers the last provider you chose and restores it if it is still available; otherwise it uses the first configured AI provider, then Icarus Offline.

| Provider | Turns on when | Default model | Billing |
|---|---|---|---|
| Icarus Offline | always | rule-based | free |
| Claude API | `ANTHROPIC_API_KEY` is set | `claude-opus-5-5` (`ANTHROPIC_MODEL`) | your Anthropic account |
| OpenAI API | `OPENAI_API_KEY` is set | `gpt-6-astra` (`OPENAI_MODEL`) | your OpenAI account |
| Claude Code CLI | `CLAUDE_CLI_PATH` is an absolute path | CLI default (`CLAUDE_MODEL`) | your Claude Code login |
| Codex CLI | `CODEX_CLI_PATH` is an absolute path | CLI default (`CODEX_MODEL`) | your Codex login |

Model IDs are passed through as written and must be a single token (no spaces or flags). If the provider rejects a model, the coach shows which setting to check.

## What is sent

Only when you send a message: the conversation (up to 40 turns) and a short training summary (goal, level, equipment, session length, units, a text summary of the active plan, the last five workouts and the session in progress). It is labelled as data, not instructions. Nothing else from your browser storage leaves the device. API keys stay on the server; the browser never receives them.

## Every reply is validated

All providers must return the same structure: a text reply, an optional workout, an optional split id and up to four follow-up suggestions. The server checks it against a schema (`src/shared/coach/contracts.ts`) with product limits (sets 1–10, reps 1–100, holds 5 s–60 min, rest up to 10 min, 20 exercises per session). Unknown exercise ids are re-matched to the catalog by name. Invalid replies are rejected with a clear error; the conversation stays intact so you can retry.

## Claude API

Uses the official Anthropic SDK (`@anthropic-ai/sdk`) with structured output (`output_config.format`), cached instructions, `effort: "medium"`, and server-side refusal fallback (`fallbacks: "default"`), which retries a policy decline on the model's default fallback. A refusal that still stands is shown as "The model declined that request".

## OpenAI API

Uses the Responses API with a strict JSON schema and `store: false`. Provider error bodies are never shown to the user.

## Claude Code CLI

Runs `claude --print` per message in an empty temporary directory with a minimal environment (no API keys, tokens or proxies from the server), the prompt on stdin, and tools, MCP servers, hooks, slash commands and session persistence switched off. The stream is inspected and the process stopped if any tool other than structured output appears. Required flags are detected from `claude --help`; there is no version pin and no platform block. Log in once by running `claude` in a terminal.

## Codex CLI

Runs `codex exec --json --ephemeral --sandbox read-only --ignore-user-config --ignore-rules` in an empty directory, with every tool family reported by `codex features list` disabled (shell, unified exec, apps, plugins, browser and computer use, image tools, hooks, memories and more; the list is in `src/server/providers/codex-cli.ts`). The JSON event stream is inspected and the process stopped at the first item that is not a message, reasoning or to-do item. Log in once with `codex login`.

These flags were checked against codex-cli 0.163.0. The tripwire is a safeguard, not an operating-system sandbox: the stream reports an item when it starts, so a command could begin before the process is stopped. The read-only sandbox prevents writes, but a started command could read files the server user can read; its output is discarded with the reply. Do not enable this provider on a shared or public server.

## What was tested

Adapters are covered by unit tests with fake transports (`tests/cli.test.mjs`, `tests/http.test.mjs`). No live request to Anthropic, OpenAI, Claude Code or Codex was made while building this version, because the build environment had no network access to those services. Verify a provider with your own credentials before relying on it.
