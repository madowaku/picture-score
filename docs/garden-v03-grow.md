# Garden v0.3 — GROW

> **What is heard leaves a trace.**
>
> 音を置くと、世界が少しだけ育つ。

Garden v0.1 made drawings spatial. Garden v0.2 made proximity become arrangement. v0.3 should make repeated listening visibly change the Garden so the world gradually becomes *this user's place*.

The goal is not farming, collection, progression, decoration unlocks, or an idle game.

The goal is:

**Draw → Place → Listen → Ensemble → The place changes → Notice another quiet space → Draw again**

The Garden should feel as if it remembers music.

---

## North star

At first the Garden is nearly blank.

Place one Picture Score and listen. A tiny trace appears around it.

Listen longer and the trace becomes a small habitat. Put another work nearby and let them answer each other. After they have shared enough music, a faint path grows between them.

After several drawings, the user looks back and realizes:

> **The world looks different because of the music I made.**

That is the v0.3 emotional payoff.

---

# Design rules

## 1. Growth comes from heard music, not elapsed wall time

No offline growth. No growth while the Garden is stopped. No progress for merely leaving the page open.

Growth advances only while an object is actually audible in the Garden mix.

Suggested threshold:

- object target/effective gain > 0.015
- Garden transport running
- page visible

Count **musical beats**, not seconds, so changing BPM does not change how many musical phrases are required.

## 2. Ensemble relationships grow together

A pair may accumulate shared growth only while:

- both objects are audible
- their v0.2 ensemble relationship is active
- relationship strength is meaningfully above the weak transition zone

Suggested start threshold: `strength >= 0.35`.

The stronger the relation, the faster shared growth may advance, but cap the rate so dragging two works together does not instantly create a mature connection.

## 3. No numbers in the normal UI

Do not show XP, percentages, level bars, growth currencies, streaks, or rewards.

Growth is perceived through the Garden itself.

Debug/test data may expose exact beat counters through data attributes or development diagnostics.

## 4. Drawings remain the stars

Growth must render **behind** Picture Score artworks and never obscure their line work.

Use quiet SVG/CSS forms with the existing paper-like palette. No bright particles, loot effects, badges, or cartoon vegetation.

## 5. Shape-derived musical role determines growth character

Do not use semantic image recognition.

Use the musical role already inferred from the drawing:

- `melody` → a few stems/leaves, gently reaching outward
- `harmony` → low rosette / rounded ground shapes
- `drone` → long grass-like arcs / calm rings
- `rhythm` → small seed/point patterns
- `decoration` → sparse tiny star/bloom marks

These are abstract visual echoes of the music, not literal objects.

---

# Growth model

Persist growth separately from Stroke/Score/Music IR. Growth is Garden-world state and must never mutate the original artwork.

Suggested model:

```ts
interface GardenGrowthState {
  version: 1
  objects: Record<string, ObjectGrowth>
  relations: Record<string, RelationGrowth>
}

interface ObjectGrowth {
  objectId: string
  audibleBeats: number
  lastAnchor: Position
}

interface RelationGrowth {
  key: string          // stable sorted pair key: "a::b"
  a: string
  b: string
  sharedBeats: number
}
```

It may be embedded in a migrated GardenState version or stored under a dedicated growth key. Prefer the option that gives safest backward compatibility with existing v0.1/v0.2 saves.

Requirements:

- loading a pre-GROW Garden initializes zero growth without losing positions or IR
- corrupt growth data must not cause valid Garden/artwork data to be overwritten
- removing an artwork removes its active growth and relation records
- IDs and pair keys are deterministic

For v0.3, growth follows the currently placed artwork when it is moved. Do **not** implement abandoned historical footprints yet. The emotional hypothesis should be tested before adding world-history complexity.

---

# Growth stages

Use continuous internal values but only a few visually meaningful stages.

Suggested object milestones:

- **0–3 audible beats:** bare, no persistent growth
- **4 beats:** first tiny mark / sprout
- **16 beats:** small local cluster
- **32 beats:** mature local habitat
- **64+ beats:** do not expand indefinitely; only subtle density/variation within a strict cap

Suggested relation milestones:

- **0–7 shared beats:** no persistent connection
- **8 beats:** barely visible thread
- **24 beats:** clear but delicate path
- **48 beats:** mature connection, optionally a few tiny nodes/leaves along the path
- **64+ beats:** capped

These values are starting points. Keep constants centralized for listening calibration.

The first visible result should arrive quickly enough that a user notices the world responding during a short session, but not so quickly that moving two objects together creates instant scenery.

---

# Rendering

Add a world-growth layer beneath artworks, preferably one SVG covering the Garden field.

Suggested order:

1. paper/landscape background
2. **growth layer**
3. v0.2 ensemble relationship feedback when relevant
4. artworks
5. listener / interaction chrome

Growth layer requirements:

- `pointer-events: none`
- no influence on placement hit testing
- deterministic from persisted counters + stable object IDs
- no random layout differences after reload
- responsive to field resizing
- visually quiet at 1 object and bounded at 12 objects

If variation is needed, derive pseudo-random seeds from stable IDs. Never call uncontrolled randomness during render.

## Relation paths

Use a soft curve between object positions rather than a straight UI connector.

The path should feel grown, not diagrammed.

- low opacity
- thin width
- slight deterministic curvature
- mature paths may get 1–3 small abstract nodes
- selected v0.2 relationship UI must remain distinguishable from persistent GROW paths

A relation path is a memory of repeated ensemble, not an explanation overlay.

---

# Growth moment

Growth should not continuously wobble or sparkle.

When an object crosses a milestone (4 / 16 / 32 audible beats), allow one tiny one-shot response:

- a stem extends a few pixels
- one leaf/mark unfolds
- a ring settles

When a pair crosses a relation milestone, its thread may quietly draw itself once.

Duration target: roughly 300–700ms.

Respect `prefers-reduced-motion`: show the new state without the one-shot animation.

Do not play an additional reward sound. The music itself is the reward.

---

# Audio integration

GROW must observe the existing v0.2 mix/ensemble state, not create a second music engine.

Do not:

- restart transport
- create new voices for growth
- alter note scheduling
- alter ensemble decisions
- change artwork gains to trigger growth

Growth counting should be driven by the same shared musical clock.

A robust approach is to accumulate deltas only on beat/quarter-beat boundaries using current effective audibility and current ensemble plan.

Avoid counting from React render frequency or `setInterval` wall time.

---

# UI copy

Do not add a tutorial modal.

The existing Garden copy may gain one light contextual sentence after first growth appears, e.g. Japanese:

> 聴いた音は、庭に少しずつ残ります。

English:

> What you hear leaves a little trace.

After the first pair-connection appears:

> 一緒に歌った場所に、道ができました。

> A path grew where they sang together.

Show each discovery at most once per browser/profile and do not interrupt interaction.

---

# Explicit non-goals for v0.3

Do **not** add:

- XP / levels / currencies
- daily rewards or streaks
- collectible plants
- planting menus
- watering / tapping mechanics
- semantic recognition (cat → cat habitat, flower → flowers, etc.)
- seasons, weather, day/night
- biome unlocks
- world expansion
- multiplayer/public Gardens
- likes/comments/follows
- offline growth
- procedural terrain
- SylphNote integration
- AI-generated scenery

Those may be explored later. v0.3 tests one hypothesis only:

> **Does visible musical memory make the user care about the Garden and want to add another sound?**

---

# Suggested files

```txt
src/garden/
  growth.ts             # deterministic growth accumulation and stages
  GrowthLayer.tsx       # render object habitats + relation paths
  growth.test.ts
```

Integrate minimally with:

- `gardenState.ts` for persistence/migration
- `gardenTransport.ts` or a shared transport observer for beat-accurate accumulation
- `ensemble.ts` for relation strength/active pairing
- `GardenView.tsx` for layer rendering + one-time discovery copy
- `garden.css`

Avoid pushing growth logic into the DRAW/music interpretation code.

---

# Acceptance criteria

Garden v0.3 is successful when all of these are true:

1. A newly placed work begins with a nearly bare area.
2. While listening, the first visible growth appears after a small number of audible beats.
3. A work that is inaudible due to distance/role resting does not grow as if it were playing.
4. STOP, hidden tab, and inactive Garden do not advance growth.
5. Two works in an active v0.2 ensemble accumulate a shared relation.
6. After enough shared beats, a persistent subtle path appears between them.
7. Separating the works stops additional shared growth; it does not erase earned growth.
8. Moving works does not restart audio transport and does not reset their earned growth.
9. Growth survives reload and DRAW ↔ GARDEN round trips.
10. Old v0.1/v0.2 Garden saves load safely with zero initial growth.
11. Removing an artwork cleans its growth and pair records without damaging other state.
12. A 12-object Garden remains visually readable and audio behavior is unchanged from v0.2.
13. 390×844 touch placement/movement remains usable with no growth layer pointer interference.
14. `prefers-reduced-motion` gives an equivalent static result.
15. Existing DRAW, export, i18n, save-corruption safety, v0.1 mixer, and v0.2 ensemble tests remain green.

---

# QA scenarios

## A. First sprout

- place one Wave
- start Garden
- keep listener close
- verify no immediate mature scenery
- verify first mark at the first configured milestone
- continue to stage 2 and stage 3

## B. Silence does not grow

- record counters
- STOP for several seconds
- verify unchanged
- move listener far enough to make work inaudible while transport runs
- verify unchanged/appropriately paused

## C. Two works learn each other

- place two Waves far apart
- listen: no shared growth
- move them into strong ENSEMBLE range
- listen through multiple phrases
- verify relation milestones and path
- move apart
- verify path remains but counter stops advancing

## D. Role characters

Create/seed representative melody, harmony, drone, rhythm and decoration objects. Verify each gets a visually distinct but stylistically coherent growth grammar.

## E. Persistence and migration

- load v0.2-style state with no growth payload
- verify clean zero-growth migration
- grow several objects/relations
- reload
- verify exact stages/counters and deterministic rendering
- corrupt only growth payload and confirm valid Garden is preserved according to chosen safety policy

## F. Dense Garden

- 12 objects, several nearby ensembles
- run long enough to reach mature stages
- verify no unreadable thicket, excessive DOM/SVG nodes, pointer obstruction, frame instability or audio regression

## G. Mobile

390×844 touch:

- place
- listen
- drag artwork while playing
- drag listener
- return DRAW and back
- verify growth follows positions and touch targets remain usable

---

# Performance bounds

Keep persistent visual complexity intentionally small.

Suggested hard bounds:

- <= 12 object habitats
- <= 24 visible mature relation paths (prefer fewer by pruning to relationships that have actually earned milestones)
- <= ~8–12 SVG primitives per mature object habitat
- <= ~4 decorative nodes per mature relation

Do not animate every plant/mark every frame. One-shot milestone animations only.

---

# After v0.3

Do not implement these as part of this issue, but preserve room for them:

- **Garden v0.4 MEMORY**: old places retain faint traces when a work is moved
- **Garden v0.5 WEATHER / SEASONS**: environment transforms Music IR presentation
- **SylphNote bridge**: Picture Score sound seeds can live in a larger reactive world

GROW should make those futures possible without depending on them.

---

# Final test

The decisive QA question is not technical:

> Look at the Garden after 5–10 minutes. Does it feel more like *your place* than it did when it was blank?

And then:

> Is there somewhere in it that makes you think, **“ここにもうひとつ置きたい”**?

If yes, GROW is working.
