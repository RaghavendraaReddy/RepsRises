# DECISIONS: why v2 is the way it is

For you only. It is not in the ZIP: the packager ships `docs/`, not the repo root. Read this before the
30-minute call so you can explain every choice in your own words.

## Final pass (read this first)
The character is now **Aira**, not Pip. Everything below that says "Pip", or quotes space-themed
moves (Comet Hops, Orbit Hold), describes the version recorded in `runs/v2/` before the rename. The
final pass changed:
- **The name, everywhere users see it.** The intro line is now "Hi, I'm Aira. I do the moves,
  you're my coach and run the clock."
- **Plain, everyday move names** (Arm Circles, Side Steps, Reach Up, Wall Sit), which Aira performs
  in the first person ("I'm doing slow arm circles. Shoulders say thanks."). She never tells the user
  to do them, so the protocol's "no exercise prescription" rule still holds.
- **"Aira says"** now sits under the move title. The page scrolls to the workout when a session
  starts.
- **A 3-step first-visit tour** (remembered in localStorage) and **one-at-a-time tips** pointing at
  the next button. The clock tip sits beside the button so it never hides the time.
- **Live evidence:** one ClaudeCLI message on the final skill ("give me a shoulder workout" →
  Aira's Shoulder Day, valid, 22.7 s). The 28-turn round is from before the rename.

If asked: **"Why real move names now?"** They're clearer for a normal person. The safety line is
that Aira does them and the user only runs the clock.

## The story in one breath
A first-timer should always know what to do now, why, and what's next. Pip should feel like a friend,
not a manual. v1 had the plumbing right but read like a control panel. v2 makes Pip the one
character and gives every screen one obvious thing to do. Pip keeps talking at the right moments,
and nothing breaks when the AI fails.

## The constraint that shaped everything
`prompts/system.md` is the starter's protocol, and it forbids "exercise prescription" and
"physical-exertion instructions". So the coach can never tell a real person what to do with their
body. That is exactly why v1's live model answered "I can't give shoulder exercises".

**Decision: Pip does the moves; you run the clock.** The user's job is to tap Start the clock, pause,
finish early, and decide when to go lighter or harder. This:
- keeps every safety rule (nothing physical is asked of anyone);
- gives the user a real job, so "what to do now" always has an answer;
- matches AiRA's product: a character with a voice, not a timer.

I did not edit `prompts/system.md`. Those are their safety rules, and weakening them to get "real"
exercises would be the wrong signal.

*If asked "isn't watching a cartoon exercise weird?"*: the brief says "fictional workout" and "no
exercise is required". The fiction is the point. And cheering on a small character you're responsible
for is a nice consumer moment in its own right.

## Change 1: Pip is the only character (`skills/workout.md`, `src/server/coach-script.ts`)
- **v1 had two voices.** An unnamed "mission control" narrator plus Pip the trainee, so "who is Pip?"
  was never answered. v2 merges them: Pip speaks in the first person and calls you "coach" now and then.
- **One unmistakable role line,** "I do the moves. You run the clock.", appears on the very first
  screen (before typing) and again on the plan screen. Every button label fits that role: Start the
  clock, Pause, Resume, Finish early.
- **Never a flat refusal.** A body part becomes a theme ("Pip's Shoulder Day": Wing Flaps, Star
  Shrugs…). A real-exercise request gets one honest line ("I'm a cartoon, so I do the moves and you run
  the clock"), then the closest session. A time limit is a ceiling, and Pip says the total. Pain or
  injury gets a kind "that's one for a real doctor" and an offer to end. Off-topic gets one line, then
  the next step.
- **Plain words.** Banned: mission control, simulation, launch pad, docked, screen, cursor, and
  narrating the app ("I've set up"). v1's good rules stayed: short lines, open with what the user
  just did, praise by noticing ("You didn't rush me once"), never guilt.
- **Honesty rule: "never claim a change you did not make."** v1's Mock said "Shorter moves from here"
  on the last move when nothing changed. v2 checks what can actually change: a clock that hasn't
  started can shrink; a running one can't (changing it would reset it). If nothing can change, Pip
  says "This is the last one, and it's already going."
- **Mock mirrors live.** Reviewers usually run Mock first, without keys. So the scripted Pip handles
  the same things as the skill: the 3 starter buttons, 6 body-part themes, time limits, honest
  lightening, skips, breaks, early finishes, medical, off-topic, bonus move and the report. It's a
  second copy of the behaviour (the starter's Mock never reads the skill), and unit tests pin it.

## Change 2: one flow, one progress bar, one main button (`src/web/*`)
- **Before typing,** Pip says hi with the role line and three one-tap starts ("I'm new, go easy"
  is the filled one). A first-timer never faces a blank box.
- **One progress indicator.** v1 showed a 6-screen stepper, "1 / 6", "Move 1 of 4" and "0 of 4
  done", which disagreed. Now a screen with Progress hides the stepper. The bar counts moves only,
  marks which one was skipped, and reads "4 moves · about 3 min" → "Move 2 of 4 · 1 done" → "3 of
  4 done · 1 skipped". Titles dropped "Move K of N", so the AI can't miscount after a change.
- **One filled button per moment:** Start the clock → (nothing filled while it runs: just watch) →
  Resume if paused → **Next: Orbit Hold →** once it ends → **See how we did →**. Secondary actions
  are quiet chips. Send only turns dark when you've typed something.
- **"Let's start" is gone.** In live mode it was a 12–15 s AI round trip just to move to move 1.
  Next is local and instant, and each move already has its line written.
- **The chat is a conversation, not a log.** Replies are labelled "Pip". System events ("Tapped … on
  screen s0", "This is not evidence of physical completion") are hidden, but they still go to the
  AI and still appear in Builder tools and exports.
- **The report is "How we did":** what happened per move, one specific encouraging note, and one
  "Next time:" suggestion. The duplicate buttons are gone.
- I left the page shell alone ("Make a workout make sense", "Run with", footer). It is the starter's
  frame for reviewers, not the experience.

## Change 3: failures don't break the workout (`src/web/app.ts`, `src/shared/controller.ts`)
- **A failed turn shows Pip's line:** "Pip lost the thread for a second. Your place is kept: keep
  going, or try again." (or "Pip took too long to answer"), with **Try again**. The real technical
  reason sits under it in small grey type for builders.
- **The screen, clock and Next keep working** during the error. That's the honest meaning of "keep
  going".
- **Local guards aren't failures.** "You're on a break. Tap I'm back first." has no Try again,
  because nothing failed.
- **Bug found in live testing, fixed:** after a failure, tapping the same chip again did nothing.
  The starter blocked any repeat of the last message; now only a repeat while waiting is blocked.
- **No automatic retry.** It would spend the user's quota without telling them.

## Beats: Pip speaks at the right moment
- One new component, `Beats(going, halfway, done, waiting)`, written by the AI once per move. The
  browser shows each line in Pip's spoken lane at the right second: arrival (the Cue), clock start,
  half time, clock end (the "rest" beat), and after 20 s of the coach going quiet. No extra AI calls.
- **Optional by design (your requirement).** A malformed, empty, oversized or misspelled Beats, or a
  reference to Beats never written, is dropped before validation, and the rest of the reply renders.
  Any *other* invalid statement still rejects the reply as before. The drop is noted in the run
  export for builders.
- **Cost:** a few more seconds on the first reply, because the AI writes four short lines per move.
- Beats never mention seconds or the next move, so they stay true when the plan changes.

## The avatar
A tiny hand-drawn Pip next to the spoken line. It's built from SVG by trusted code (no AI-generated
markup) and CSS-animated: it blinks when idle, hops while the clock runs, shuts its eyes on a pause,
cheers with a star when a move ends, looks up while thinking and tilts on an error. It's static when
the user prefers reduced motion. It's the cheapest possible nod to "a character with voice and animation".

## What I deliberately did not build
- **Real exercise content, audio or voice:** the protocol rules them out.
- **An AI turn after every timer:** about 15 s each. The AI speaks at decision points; Beats cover
  the moments in between.
- **Rest screens:** the done beat is the rest. Extra screens would make "progress" mean timers.
- **Automatic retries:** hidden quota use.
- **Accounts or history across sessions:** out of scope.

## How it was tested
- **Mock:** 16 browser tests (all pass) and 44 unit tests (40 pass; the 4 failures are Windows-only
  and also fail on the untouched starter). The new tests pin the welcome screen and role line, one
  filled button per moment, the single progress bar, the full Mock flow, honest lightening, the
  report, both forced failures, the break guard, the timed lines (with a fake clock), Beats
  tolerance, and resending after a failure.
- **Live ClaudeCLI, final skill (hash `76bbb69b14…`):** 28 scripted browser turns over 8
  first-timer scenarios: first-timer, shoulders, 5 minutes, skipper, pauser, fast finisher,
  tired-on-the-last-move, knee pain and off-topic.
  - **0 invalid screens, 0 errors, 0 page errors.** Beats were written for every move, none dropped.
  - **Median reply 14.5 s; first replies 18–30 s.**
  - **Exports:** `runs/v2/after-live-claude-*.json`. **Screenshots:** `evidence/screenshots/v2/live-*`.
- **Earlier spot check:** 5 live first messages right after change 1, before Beats. No refusals;
  "teach me push-ups" became "Pip's Push-Up Day". Not kept as evidence, because the skill changed
  after it.
- **Forced live failure:** a second server with `CLAUDE_MODEL=claude-not-a-real-model`. Pip's line
  appeared in 3.4 s, the clock kept running, and Try again failed honestly. Exported as
  `runs/v2/after-live-claude-forced-failure.json`. This is also where I found the resend bug.
- **Slips I saw and left (4 of 28), so you can own them in the call:**
  - one 27-word opening (limit 25);
  - "I can't see any sky from up here" (playful, but it opens with "I can't");
  - "I'm quick but not that quick" (reuses a tone example from the skill);
  - "I added a bonus move" (narrates the app).

  Fixing them means a skill edit plus a new live round. I chose stable evidence over a last-minute
  tweak.

## Known limits (say these before they find them)
- **Latency:** live replies take 15–25 s (first reply up to ~30 s) on the default model. Beats and
  local Next hide most of it, but the first reply and the report still wait.
- **The starter's CLI error classifier mislabels some failures.** An unknown model showed as "This
  CLI version does not support the restricted profile" and then as "login is missing". The friendly
  line is right; the grey detail can mislead. I left the starter's classifier alone.
- **Two copies of the behaviour:** Mock is a script, so its lines are fixed and must be kept in step
  with the skill by hand. Unit tests catch drift on the important branches.
- **OpenAIAPI was not run live** (no key). The skill is provider-neutral, but that's unverified.
- **The plan list on the first screen isn't rewritten** when a move is dropped for a lighter finish.
  The progress bar is right, but the plan list keeps the original moves if you go back.
- **4 unit tests fail on Windows only,** on the untouched starter too: the CLI platform guard and
  symlink permissions.

## What I'd do next
1. **Measure the first-timer:** where they hesitate, and how many reach "How we did".
2. **Cut first-reply latency:** a smaller model for the plan and the bigger one for reactions, or
   stream the plan screen.
3. **Real voice and sound for the Beats**, since that is AiRA's product.
4. **Remember the last session,** so "Next time:" actually happens next time.

## Likely questions
- **"Why not just give real exercises?"** The protocol forbids it, and I'd rather ship inside the
  rules than argue with them in a take-home. The role flip turns the constraint into the concept.
- **"How do you know the AI behaves?"** 28 scripted live turns across 8 first-timer scenarios,
  with automatic flags for banned words, refusals and long replies, then every reply read by hand.
  0 invalid screens and 4 small voice slips, plus a forced live failure. Every run is exported in
  `runs/v2/` with the skill hash.
- **"What did you question in the AI's output?"** v1's own work: it looked fine in tests, but the
  live model still refused, the Mock coach said untrue things, and the screen had four progress
  signals. The v1 → v2 section of SUBMISSION.md lists what changed my mind.
- **"Why is Mock a separate script?"** The starter's Mock never calls a model. Reviewers without keys
  deserve the same experience, so I mirrored it and pinned it with tests.

## 3-minute demo
1. Fresh page: point at "I do the moves. You run the clock." Tap **I'm new, go easy**.
2. **Next: Comet Hops →**, **Start the clock**. Watch the line change to "Here I go." and Pip hop.
   Then **Finish early**. The bar fills and Pip says the done line.
3. Tap **Skip this move** twice to see Pip offer a shorter session. Tap **Make it shorter** on the last
   move to see the honest answer.
4. **See how we did →**: the per-move list, the note, and "Next time:".
5. Builder tools → Next mock response → Invalid OpenUI schema, then tap a chip: Pip's failure line,
   the clock still runs, **Try again** recovers.
6. Reset and type "give me a shoulder exercise": Pip's Shoulder Day, no refusal.
