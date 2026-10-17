# Aira's training session

**Point of view:** a first-timer should always know what to do now, why, and what's next, and Aira
should feel like a friend, not a manual.

**Run it:** `npm ci --ignore-scripts && npm start`, open http://127.0.0.1:4319, follow the short
tour, then tap **I'm new, go easy*. Mock needs no key. Checked from a fresh unzip.

**What it is:** a fictional workout where **Aira, a tiny cartoon in training, does every move and
you're her coach and run the clock**. The protocol forbids exercise instructions. So instead of
refusing ("I can't give shoulder exercises"), Aira does the request herself: "shoulders" becomes
*Aira's Shoulder Day* (Shoulder Rolls, Arm Circles…), and she never tells the user to do a move.

## Problems I found (my v1, played as a first-timer)
1. The live coach opened with "I can't…" and ignored the request.
2. Before typing, it was a developer page ("In Mock, start with /demo"); the character was never
   introduced.
3. The move screen had 9 equal buttons and 4 progress signals that disagreed.
4. Mock said untrue things ("Shorter moves from here" on the last move).
5. System logs appeared in the chat, and failures read like developer messages.

## What I changed
1. **One character with one role line.** *"Hi, I'm Aira. I do the moves, you're my coach and run the
   clock."* Body parts become themes, time limits are ceilings, and pain gets "check with a doctor".
   Aira never claims a change she didn't make. Mock mirrors the live skill.
2. **One flow, one progress bar, one main button.** "Move 2 of 4 · 1 done" replaces the stepper.
   One filled button per moment. "Let's start" was a 12–15 s AI round trip and is now an instant
   Next. The ending, "How we did", has one honest note and one "Next time:".
3. **Failures don't break the workout.** Aira's line, the technical reason in small type, and **Try
   again**. The clock and Next keep working.
4. **Beats:** Aira's timed lines for clock start, half time, the end and going quiet. The AI writes
   them once and trusted code plays them. Invalid Beats are dropped, never fatal. Plus a tiny drawn
   avatar.

**Final pass**
- **Renamed Pip → Aira** everywhere a user sees it: chat, welcome, screens, "Aira says", avatar
  label, Mock and skill.
- **Plain move names** (Arm Circles, Side Steps, Reach Up, Wall Sit…), described by Aira in the first
  person, with everyday themed sets per body part. No space theme.
- **"Aira says"** (avatar + line) sits right under the move title. The view scrolls to the workout
  when a session starts, so it's visible without scrolling at 1366 × 768.
- **A first-visit tour:** 3 bubbles (chat, workout, "Aira says") with Next and Skip. It's remembered
  in localStorage; the footer has "Show tour again".
- **Guided tips:** one at a time, beside or above the button and never covering it or the timer. Each
  disappears for good once its button is pressed. "Hide tips" is in the tip and the footer.

## v1 → v2: what I learned
- **Passing checks ≠ a good first minute.** v1 had 0 invalid screens in 101 live turns and still lost
  a first-timer in 10 seconds.
- **The constraint is the concept.** Refusing because of the rule was the bug; building the role
  around the rule fixed it.
- **One voice, and every promise needs a check.** Two voices made no character.
- **Latency is product.** Local navigation and pre-written lines feel alive without more AI calls.

## Runtime modes tested
| Mode | Result |
|---|---|
| Mock · Normal | Every flow, plus a full first-visit run (tour → tips → report) at 1366 px and at phone width. |
| Mock · Slow / Invalid schema / Failed request | Aira's failure line; screen and clock keep working; Try again recovers. |
| **ClaudeCLI, final skill** | One message, "give me a shoulder workout": Aira's Shoulder Day with plain moves, valid screen, Beats on every move, 22.7 s (`runs/final/`). |
| ClaudeCLI, earlier version (Pip, space names) | 28 turns, 8 scenarios: 0 invalid screens, 0 errors; median reply 14.5 s (`runs/v2/`). The flow rules are the same; the names and copy changed after this round. |
| ClaudeCLI · forced failure | Unknown model: failure line in 3.4 s, clock kept running (earlier version). |
| OpenAIAPI / CodexCLI | Not run (no key) / blocked by the starter. |

**Slips seen in the 28-turn round (4):**
- one 27-word opening (limit 25);
- one aside opening "I can't see any sky…";
- one reused tone example;
- one "I added a bonus move" (now explicitly banned in the skill).

## Checks and known limits
- **`npm run check`:** typecheck and lint pass; unit tests 40/44. The 4 failures are Windows-only and
  also fail on the untouched starter. `npm run test:ui`: 19/19.
- **The final behaviour file has had one live message, not a full round.** The 28-turn evidence
  predates the rename and plain names.
- **Live replies take 15–30 s.** **Mock is a hand-kept copy of the skill**, pinned by tests.
- **The starter's CLI error classifier can mislabel a failure** in the small detail line.

**Not built, on purpose:** real exercise instructions or audio, an AI turn per timer, rest screens,
automatic retries, accounts. **Next:** a full live round on the final skill, watch real first-timers,
cut first-reply latency, give the Beats a real voice.
