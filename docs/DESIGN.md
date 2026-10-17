# Design language

Icarus borrows the posture of high-end automotive sites such as Pagani's (dark cinematic stages, very large light-weight type, wide-tracked labels, sparse navigation, engineering detail treated as decoration) and applies it to fitness. It does not reuse any Pagani asset, layout or copy.

## Principles

1. **Two surfaces, chosen by task.** Obsidian and charcoal for immersion: the homepage hero, the audience picker, location, coaching packages, the active workout and the menu. Warm ivory for reading, comparing and filling in forms: gym search and detail, memberships, the booking request, nutrition, the library and settings. Each section paints its own surface, so a page can alternate without losing contrast. Ivory screens switch to graphite "night paper" when the system or the user asks for dark.
2. **Editorial type, technical numbers.** Cormorant Garamond Light for headlines (italic for the emphasised word), Barlow Condensed for labels and every number (prices, timers, sets), Inter for body text and controls. All self-hosted under the SIL Open Font License.
3. **Hairlines, not boxes.** 1 px rules and generous space separate content. Corners are 2 px. Shadows appear only on floating layers.
4. **Bronze for emphasis, burnt orange for state.** Champagne bronze marks eyebrows, emphasis and selected detail. Burnt orange (`#e2552b`) marks only what is active or needs attention: the current step, a running timer, a selected option's edge, a demo label, a warning.
5. **One obvious next action.** Each screen has at most one filled, high-contrast button per section.
6. **Honest labels are part of the design.** "Demo listing", "Not verified", "Received, not yet confirmed" and "No verified reviews yet" use the same badge system as everything else: visible, calm and never hidden in small print.
7. **Motion with restraint.** Content rises in once; exercise demonstrations crossfade between start and finish frames and can be paused or stepped. Under reduced motion (system or in-app) the start frame holds still and transitions are instant.

## Photography

Exercise demonstrations and representative gym imagery are real photographs from Free Exercise DB (public domain). Demonstrations are shown in natural colour, because accuracy matters. Representative gym images are slightly desaturated and always captioned "Not a photo of this gym". The homepage hero uses a monochrome grade with a bronze light so the photograph reads as atmosphere rather than a stock image.

No licensed photographs of children or older adults were available, so the audience cards are typographic (numeral, label, age range, focus list) rather than illustrated. This is deliberate: no generated or unlicensed images of people are used. See [ASSETS.md](ASSETS.md).

## Tokens

Defined in `src/web/styles/tokens.css`: palette, semantic surface variables (`--bg`, `--fg`, `--muted`, `--line`, `--accent`, `--signal`), type scale, 4 px spacing scale, radii, motion curves and chart colours. Components read only the semantic variables, so a surface class (`surface-dark` / `surface-light`) re-themes everything inside it.

Vertical rhythm uses `.stack` with a `--stack` gap. The property is registered as non-inherited, so nested stacks keep their own spacing.

Chart marks use a single bronze series (`#a87332` on ivory, `#bd8640` on obsidian), checked for contrast against each surface. Each chart has a hover/focus tooltip and a screen-reader table.

## Layout

- Desktop: full navigation (Discover Gyms, Personal Training, Nutrition, Workouts, Memberships & Offers), Profile and the next-step action.
- Below 1180 px: a menu button opens a full-screen, keyboard-accessible menu (native modal dialog, Escape closes, focus returns to the button).
- Phones: one column, 16 px gutters, no horizontal page scroll; wide comparison tables scroll inside their own frame. The training tab bar appears only on training screens.
