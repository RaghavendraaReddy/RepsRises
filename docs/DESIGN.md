# Design language

Icarus borrows the posture of high-end automotive sites such as Pagani's (dark cinematic stages, very large light-weight type, wide-tracked labels, sparse navigation, engineering detail treated as decoration) and applies it to training. It does not reuse any Pagani asset, layout or copy. The live Pagani site could not be opened from the build environment, so the reference was taken from published descriptions of the site and general familiarity with it.

## Principles

1. **Two surfaces, chosen by task.** Obsidian for immersion: arrival, the active workout, coaching, summaries. Warm ivory paper for reading and editing: plans, progress, library, settings. Ivory screens switch to graphite "night paper" when the system or the user asks for dark.
2. **Editorial type, technical numbers.** Cormorant Garamond Light for headlines (italic for the emphasised word), Barlow Condensed for labels and every number that moves (timers, sets, stats), Inter for body text and controls. All fonts are self-hosted under the SIL Open Font License.
3. **Hairlines, not boxes.** 1 px rules and generous space separate content. Corners are 2 px. Shadows appear only on floating layers (dialogs, toasts).
4. **One signal colour.** Solar orange (`#e2552b`), the sun Icarus flew toward, marks only live states: the primary action of the moment, a running rest timer, a logged set, a new personal best. Bronze is the quiet accent for eyebrows and detail.
5. **One obvious next action.** Each screen has at most one filled, high-contrast button.
6. **Motion with restraint.** Content rises in once; exercise figures loop slowly; nothing pulses for attention. Under reduced motion (system or in-app), figures hold their key position and transitions are instant.

## Tokens

Defined in `src/web/styles/tokens.css`: palette, semantic surface variables (`--bg`, `--fg`, `--muted`, `--line`, `--accent`, `--signal`), type scale, 4 px spacing scale, radii, motion curves and chart colours. Components only read the semantic variables, so a surface class (`surface-dark` / `surface-light`) re-themes everything inside it.

Chart marks use a single bronze series (`#a87332` on ivory, `#bd8640` on obsidian), checked for chroma, lightness and contrast against each surface. Each chart has a hover/focus tooltip and a screen-reader table.

## Illustration

Exercise demonstrations are articulated line figures drawn in SVG by `src/web/ui/figure.ts`: a side-view mannequin whose joint angles interpolate between two key poses for each movement pattern, with equipment drawn in bronze. They are original artwork, cost nothing to load, and stay sharp at any size. The arrival scene (`src/web/ui/brand.ts`) is a sun disc, orbit rings and a fan of feather strokes. No stock photography is used.
