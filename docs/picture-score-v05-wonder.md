# Picture Score v0.5 — WONDER

> **Every shape hides a musical secret.**

## Goal

Picture Score should not only convert drawings into music. It should become a playground where users discover repeatable musical laws by experimenting with shape, overlap, direction, repetition, and spatial arrangement.

The target feeling is:

- “What happens if I draw this?”
- “Wait, that changed the sound.”
- “Does it always do that?”
- “Then what if I combine these?”

WONDER is about curiosity, not feature disclosure.

The system should be **predictable enough to learn, surprising enough to explore**.

---

## Product Principle

### Do not reward discovery. Make discovery the reward.

No XP, badges, unlock popups, rarity, streaks, achievement confetti, or tutorial checklist.

When a hidden rule is triggered, the app should primarily communicate it through sound, motion, and the drawing itself.

Bad:

> CIRCLE LOOP DISCOVERED! +100 XP

Good:

- the closed shape gives one small tactile/audio response
- playback naturally repeats that phrase
- a tiny transient hint may appear, e.g. `…loop?`

The user should feel that **they noticed something**, not that the app announced a mechanic.

---

# Discovery Layers

WONDER should be built in three layers.

## Layer 1 — Immediate Laws

These must be understandable within seconds and are already partly present.

- X position = time
- Y position = pitch
- horizontal = sustain
- vertical = chord tendency
- smooth curve = legato/melodic contour
- sharp zigzag = shorter / more articulated motion
- dot / very short stroke = pluck-like event
- retracing can strengthen or thicken the sound

These are the grammar of Picture Score.

## Layer 2 — Combination Laws

These emerge when shapes interact.

Examples:

- crossing strokes can accent or harmonize the crossing point
- overlapping similar contours can create thicker harmony
- nearby works in Garden can call/answer or support each other
- alignment and arrangement in Garden can change sequencing

## Layer 3 — Secret Laws

These are discoverable musical “physics”.

They should not be explained up front.

WONDER v0.5 should implement a curated first set rather than dozens of weak gimmicks.

---

# v0.5 Secret Laws

Implement these first because they are visually understandable, musically useful, and easy to experiment with.

## 1. CLOSED SHAPE → LOOP

### Detection

A stroke or connected stroke group counts as closed when:

- end is within a configurable normalized radius of start
- total path length is above a minimum
- bounding area is above a minimum

Avoid triggering on accidental tiny circles or dots.

### Musical behavior

The phrase represented by the closed shape gains a local repeat behavior during full playback.

Recommended first behavior:

- repeat the local phrase once within its original time region
- compress timing slightly if necessary so it remains inside the containing phrase/bar window
- preserve contour and pitch identity

Do not create infinite loops in DRAW v0.5.

### Feedback

At closure:

- tiny elastic snap in the stroke/notes
- short soft response tone
- optional transient microcopy: `…loop?`

No modal.

---

## 2. RETRACE → THICKEN

If the user draws again over an existing contour with sufficient spatial overlap:

- do not merely duplicate notes at full volume
- gradually enrich the timbre / octave / harmony

Suggested stages:

- first pass: original
- second strong overlap: subtle octave or detuned companion
- third+ overlap: additional harmonic color, capped

The visual drawing can become slightly denser but must remain the user’s original lines.

This law should create the feeling that “coloring over sound makes it fuller.”

---

## 3. CROSSING → SPARK

When two non-trivial strokes cross in space:

- identify the approximate crossing X/time
- create a short accent or consonant harmonic event there

The crossing should be audible during PLAY and can give a tiny one-shot response when the second stroke creates the intersection.

Cap density so scribbles do not become a machine gun.

Suggested cap:

- merge nearby crossings within a small X/time window
- maximum crossing accents per bar

---

## 4. MIRROR → ANSWER

If a new stroke is a rough horizontal mirror / vertical mirror / time-reversed contour of another nearby stroke, produce an answering phrase behavior.

Start with only one robust variant for v0.5:

### Horizontal visual mirror across Y axis of its own bounds

This often appears in hearts, butterflies, faces, and symmetrical doodles.

Behavior:

- first half behaves like a question
- mirrored half slightly changes articulation/register and behaves like an answer

Recognition can be approximate and deterministic, not ML-based.

Do not require semantic recognition.

---

## 5. GARDEN LINEUP → CASCADE

If 3 or more Garden objects are arranged approximately along one axis with reasonable spacing:

- sequence them spatially along that axis
- each contributes a short phrase in order

Horizontal lineup reads left→right.

Vertical lineup can read top→bottom.

Requirements:

- relationship should emerge gradually while dragging
- no transport restart
- moving one object out of alignment smoothly dissolves the cascade
- existing ENSEMBLE rules remain available outside cascade windows

The user should discover that “lining things up makes music travel.”

---

## 6. GARDEN TRIAD → ROUND

If 3 audible objects form a stable, reasonably equilateral-ish triangle:

- rotate a short lead phrase between the 3 corners
- one leads, next answers, next decorates
- rotate on shared phrase boundaries

This is not semantic harmony theory. It is spatial conversation.

Triangle detection must use tolerance bands, not pixel-perfect geometry.

Avoid triggering when the cluster is tiny or nearly collinear.

---

# Discovery Hints

Hints should suggest experiments, not explain answers.

Rotate among short prompts based on what the user has and has not recently tried.

Examples:

- `閉じてみる？`
- `同じところを、もう一度。`
- `線を交差させたら？`
- `そっくりな形を描いてみよう。`
- `3つ並べてみる？`
- `三角に置いたら？`

English equivalents should match the same tone.

Hints must:

- disappear while actively drawing/dragging
- not repeat too often
- not reveal rule names
- never block interaction

---

# Discovery Memory

The product may remember which rules the current browser has triggered, but this is **not a progression system**.

Use this only to:

- avoid repeating the same hint endlessly
- bias future hints toward unexplored interactions
- optionally show a quiet personal “things you’ve noticed” page much later

Do not show counts such as `4/12 secrets found` in v0.5.

Suggested lightweight structure:

```ts
type WonderRuleId =
  | 'closed-loop'
  | 'retrace-thicken'
  | 'crossing-spark'
  | 'mirror-answer'
  | 'garden-lineup-cascade'
  | 'garden-triad-round'

interface WonderMemory {
  version: 1
  triggered: Partial<Record<WonderRuleId, number>>
  lastHint?: WonderRuleId
}
```

`triggered` may store first-seen timestamps or counts internally, but do not expose score-like numbers in the UI.

---

# Technical Architecture

Keep WONDER separate from the core source data.

Recommended modules:

```txt
src/wonder/
  wonderTypes.ts
  drawRelations.ts
  gardenRelations.ts
  wonderHints.ts
  wonderMemory.ts
```

Key rule:

**Never mutate Stroke IR to fake a discovery.**

Instead derive a transient `WonderPlan` layered above existing score/music interpretation.

Suggested shape:

```ts
interface WonderPlan {
  drawEffects: WonderDrawEffect[]
  gardenEffects: WonderGardenEffect[]
}
```

The existing source data stays canonical.

---

# Determinism

Every discovery rule must be deterministic.

Same strokes + same object positions + same settings = same detected relationships.

Do not use randomness to decide whether a secret activates.

Randomness may be used only for tiny non-semantic visual variation if it is seeded and does not affect musical meaning.

---

# Musical Safety

WONDER must not destroy the existing “shape first, music second” balance.

Rules:

- never replace the base phrase completely
- prefer accents, call/response windows, octave color, local repetition, or sequencing
- cap density
- preserve overall pitch contour
- preserve source identity
- avoid sudden large volume jumps

The effect should make the user think:

> “That shape did something.”

not:

> “The app ignored my drawing and generated a different song.”

---

# Visual Feedback

WONDER should be clearer than the old restrained AI-tool aesthetic, but still readable.

Allowed:

- elastic closure snap
- one-beat glow at crossing
- brief color pulse through retraced region
- short travelling pulse through a Garden lineup
- rotating pulse between 3 Garden objects

Avoid:

- confetti
- achievement banners
- giant particles
- full-screen overlays
- repeated textual explanation

The PLAYGROUND visual refresh should make these effects feel tactile and playful.

---

# Sound Feedback

Use a small consistent sound vocabulary.

Examples:

- closure: soft rounded click/chime
- crossing: tiny bright harmonic spark
- retrace: warm thickening response
- lineup formed: short travelling acknowledgement
- triangle formed: 3-note spatial acknowledgement

Keep these quieter than the actual musical content.

---

# Interaction Timing

Discovery feedback should happen close enough to the gesture to feel causal.

Targets:

- closure/crossing/retrace recognition: ideally < 120ms after pointer-up or stable geometry recognition
- Garden spatial relation recognition: visually acknowledge after ~150–300ms stable placement to avoid flickering while dragging
- musical arrangement changes: enter on shared beat/phrase boundaries where required

---

# Explicit Non-Goals for v0.5

Do not implement yet:

- semantic image recognition (“this is a cat”)
- AI-generated secret rules
- rule editor
- online sharing of discoveries
- XP / achievements / badges
- secret-count completion meter
- daily puzzles
- randomized loot/rewards
- hundreds of hidden rules
- physics simulation unrelated to drawing/music

Six strong discoverable laws are better than fifty shallow tricks.

---

# Acceptance Criteria

WONDER v0.5 succeeds when:

1. A closed non-trivial shape creates a clearly perceivable local loop behavior.
2. Retracing a contour audibly thickens it without runaway volume/polyphony.
3. Crossing strokes create a bounded, noticeable musical accent.
4. A simple symmetrical doodle can trigger mirror-answer behavior deterministically.
5. Three Garden works arranged in a line produce a spatial cascade.
6. Three Garden works in a triangle produce a rotating musical relationship.
7. Moving objects in/out of spatial relationships does not restart Garden transport.
8. Existing DRAW playback/export remains valid.
9. Existing Garden persistence/ENSEMBLE/GROW state remains valid.
10. No rule requires semantic image recognition or AI.
11. Hints suggest experiments but never reveal the complete mechanic.
12. Reduced-motion mode preserves functionality without essential animation dependence.

---

# QA Scenarios

## A. Closed shapes

- circle
- heart
- square-ish loop
- almost closed but outside threshold
- tiny accidental loop

Confirm only meaningful closures trigger.

## B. Retrace

- draw same curve twice
- partial overlap
- nearby parallel line
- 5 repeated passes

Confirm enrichment caps safely.

## C. Crossing

- one X crossing
- many scribble crossings
- near miss

Confirm clustering/capping.

## D. Mirror

- rough heart
- asymmetric shape
- intentionally mirrored contour

Confirm robust tolerance without false-positive spam.

## E. Garden lineup

- 3 horizontal objects
- 4 horizontal objects
- nearly aligned
- move one out then back

Confirm travelling sequence and smooth dissolve/re-entry.

## F. Garden triangle

- clear triangle
- skinny triangle
- nearly straight line
- move one corner while playing

Confirm only stable valid geometry triggers.

## G. Regression

- DRAW → PLAY → PLACE → GARDEN → DRAW
- WAV/MIDI/PNG/JSON
- reload persisted Garden
- GROW state retained
- language switch
- 360×800 / 390×844 / 720×1280 / desktop

---

# Product Test

Give the app to someone without explaining the rules.

Within 10 minutes, look for spontaneous behavior:

- do they intentionally redraw the same place?
- do they make closed shapes after noticing one repeat?
- do they start crossing shapes to test sound?
- do they rearrange Garden objects into patterns?
- do they verbally ask questions such as “what if I…?”

The strongest signal is not completion.

It is experimentation.

> **If users begin inventing their own experiments, WONDER is working.**
