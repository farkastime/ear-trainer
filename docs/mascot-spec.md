# Spec — mascot

*Written by the Engineering Manager. Reviewed at
https://claude.ai/artifact/Q1pwobePkV4EqYWsnEtn9u*

**Status: not approved.** Requirement 4 and the mounting constraint were
revised after a throwaway spike (`Spike:` commit on this branch) showed the
original wording could not be built as written. Two questions below are still
the Product Owner's to settle.

A pose-based mascot bird that reacts to what the child does: small reactions in
the corner during play, and a bigger celebration when the session ends.

This spec is behavioral. It says what must be true when the PR is done, not how
to build it.

## Why

The app teaches by association — every chord is a friendly character. Between
those characters there is nobody: correct answers get confetti and a tile pop,
but no one is *pleased*. A mascot gives the child a companion that notices.

Scope is deliberately one PR: a mascot that reacts on screen, driven by events
the engine already emits, with art that can be replaced without touching code.

## Vocabulary

- **Pose** — one drawn image of the bird. Static.
- **Reaction** — a pose plus a motion, played in response to something.
- **Sheet** — the single image file holding every pose in a uniform grid.

## What must be true

### 1. The bird appears during a session

A mascot is visible on the session screen in the bottom-right corner. It does
not overlap the Stop button (top-left), the progress trail, the hear-again
button, or any chord tile at any supported viewport size in portrait.

It is decorative: it is not focusable, not announced by screen readers, and
never intercepts a tap meant for something beneath it.

### 2. It reacts to correct answers, with variety

On a correct answer the bird plays a short celebration in place — it does not
enter or leave. Three visibly different celebrations exist and rotate, and the
same one never plays twice in a row.

The reaction fits inside the correct-answer feedback window and is finished, or
harmlessly interruptible, before the next question begins.

### 3. It reacts to wrong answers, gently

On a wrong answer the bird plays one brief, small reaction — a head-tilt or
equivalent. It reads as attentive or encouraging, never disappointed, sad, or
scolding. It is smaller and shorter than any correct-answer celebration.

This is a hard requirement, not a style note: the audience is four to seven
years old and the app is used after mistakes.

### 4. Bigger moments get a bigger reaction

On a streak milestone, a chord waking, or overtime, the bird gives a larger
celebration than any per-answer one — clearly a step up in scale.

On a level-up the bird celebrates for as long as the level-up is on screen,
which is unbounded (it waits on a Continue button). This reaction must loop
without a visible seam.

The level-up takeover is itself an overlay drawn above session content, so a
mascot confined beneath it is not visible during the one reaction specified as
unmissable. The mascot therefore draws above the level-up overlay while that
overlay is up, and beneath it otherwise.

**Open:** the Product Owner may instead drop the level-up reaction entirely.
Both are coherent; a mascot that plays beneath the overlay is not.

### 5. The session-end celebration is the biggest

When a session completes with at least one answer, the bird takes centre stage:
larger than corner size, visually the climax of the session.

It must remain legible against both the dark level-up overlay and the full
white screen flash that fires during it.

### 6. Art is replaceable without code changes

All poses live in one image file plus one manifest describing the grid and
which cell is which pose. Replacing both — with a different bird, or a
different creature — changes the mascot completely with no code edit and no
rebuild of logic.

The manifest is the contract. A sheet that satisfies it works.

### 7. It respects the existing motion and sound settings

The mascot obeys the app's reduced-motion convention: under reduced motion, or
when celebration intensity is `calm`, its movement is suppressed to a still
pose or something minimal. It follows the established JS-gating precedent
rather than relying on the CSS block, which does not currently cover every
animation.

The mascot makes no sound of its own.

### 8. The feedback timings have one source

The mascot's reactions are bounded by the same feedback durations the session
screen already uses. Those values are defined in exactly one place and read
from there by every consumer, rather than being copied.

A mascot that both imports those constants from the session screen and is
mounted by it forms an import cycle: the app fails at load with an
initialisation error, and the unit suite stays green because the test runner
resolves the cycle differently. Neither the mascot's mount point nor the
constants' home may reintroduce that cycle.

### 9. It never degrades the app

If the sheet fails to load, is missing, or is malformed, the app works exactly
as it does today: no mascot, no error visible to the child, no broken layout,
nothing thrown into the console loop. The mascot is additive.

It does not measurably affect the frame rate of existing celebrations on a
mid-range phone.

### 10. It behaves correctly at the edges

- A mascot mounting mid-session (the engine's event bus has no replay) shows a
  sensible resting state rather than nothing or a stuck reaction.
- Rapid consecutive answers do not queue reactions into a backlog that plays
  after the moment has passed.
- Leaving the session screen mid-reaction leaves nothing behind.

## The open question: competition, not the mascot

At a streak milestone the child currently receives three simultaneous
celebrations: confetti fired from the first tile, a 7rem numeral falling down
the centre of the screen, and — with this spec — a bird reacting in the corner.
The corner is the easiest of the three to miss.

Adding a fourth channel to a moment that already has three does not make the
moment bigger; it divides attention. Before this is built for real the Product
Owner should decide whether the mascot **replaces** one of the existing
celebrations at these moments or genuinely adds to them.

This is deliberately unresolved here. It changes what the workers build, so it
is a gate, not a detail.

## Out of scope

- Any change to the profile or export format. The mascot is not chosen, named,
  or persisted per profile. **A change here needs the Product Owner first.**
- Adornments, unlocks, or cosmetics of any kind.
- Replacing the 14 chord characters' emoji with art (`artUrl` stays unused).
- A mascot on Home, GetReady, Summary, or any screen other than the session and
  its end-of-session moment.
- Sound.
- Rive, or any new runtime dependency.

## Placeholder art

The PR ships a deliberately crude placeholder sheet — flat shapes, obviously
temporary — so the machinery is complete and testable before real art exists.

This is intentional. It lets the Product Owner drop candidate birds into the
running app and judge them hopping in the corner rather than as a static image.

The PR is complete with the placeholder in place. Shipping real art is a later,
separate change: replacing two files.

## The asset brief

Not part of the code. Recorded here so the contract and the commission stay in
one place.

**The character:** a small songbird — robin, wren, or similar. Distinct from
the existing Chick and Owl chord characters. Musical, friendly, readable at
small size.

**Approach:** pose-based, not fully drawn frame animation. A small number of
clean, *consistent* poses; the code supplies motion via transforms. This is
deliberate — character consistency across many frames is the common failure
mode of AI-generated sprite sheets, and inconsistency reads as flicker.

**Poses required:**

| Pose | Purpose |
|---|---|
| `rest` | Default. Neutral, alert. |
| `listen` | Head cocked, attentive. While a chord plays. |
| `cheer_a` | Celebration variant 1. |
| `cheer_b` | Celebration variant 2. Distinct silhouette from A. |
| `cheer_c` | Celebration variant 3. Distinct from both. |
| `tilt` | Small, gentle. The wrong-answer reaction. |
| `big` | Wings out, full joy. Level-up and session end. |

Seven poses. The three cheers must differ in **silhouette**, not just detail —
wings up vs. wings out vs. leaning — or the variety will not register at corner
size.

**Format:**

- One PNG, transparent background. Not webp: the service worker's precache glob
  covers png and svg but not webp.
- Uniform grid, one row, left to right, in the order above.
- 256x256 per cell. Drawn to read clearly when displayed at ~96-120px, and to
  hold up at ~400px for the finale.
- Bird centred in its cell with ~10% padding so motion does not clip.
- Consistent size, proportion, palette and line weight across every cell. A
  pose that shifts the bird's size or markings will read as a glitch.

**Also worth asking for:** the layered source file, and a `sad` pose even
though v1 does not use it — cheap while the character is open, expensive later.

## What is explicitly not decided here

Where the mascot sits in the DOM or canvas, what the component is called, how
poses map to motion, and the exact durations. Those belong to the workers and
the Test Engineer, within the behaviour above.
