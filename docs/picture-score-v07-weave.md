# Picture Score v0.7 — WEAVE

> **Relationships become landscape.**
>
> 一緒に鳴った時間が、作品と作品のあいだに景色をつくる。

## Goal

Picture Score already lets drawings become music, live in Garden, react to real musical events, and grow local habitats without covering the artwork.

v0.7 WEAVE moves the next layer outward:

**not only “this drawing grew”, but “these drawings have lived together.”**

The Garden should gradually reveal a visual memory of musical relationships without becoming a node graph, game board, or decorative clutter field.

The target feeling is:

- “These two have been singing together.”
- “That row feels like a little trail.”
- “Something happened in the middle of that triangle.”
- “What changes if I move this one over there?”

WEAVE must increase curiosity about spatial arrangement while preserving the open, breathable Garden established by CLEARING.

---

# North star

At 12 works, the Garden must still read in this order:

1. **the user's drawings**
2. **their local habitats**
3. **relationship landscape**
4. background texture

Never reverse that hierarchy.

The Garden should look richer because relationships exist, not busier because more marks were added.

---

# Core principle

## Relationship traces are land, not UI connectors

Do not draw graph lines between nodes.

Persistent relationship visuals should read as:

- paths
- tiny clearings
- seed trails
- shared bloom patches
- watercolor pools
- lightly connected ground marks

Temporary ALIVE feedback can still show a brighter traveling relation pulse during actual sound events, but WEAVE persistence must feel embedded in the ground.

---

# Source of truth

Reuse actual musical evidence already available from Garden transport / GROW relation accumulation.

Do not infer relationship history from mere proximity or elapsed wall time.

A relationship landscape may grow only from musical evidence such as:

- both works actually audible
- an ENSEMBLE relation active with meaningful strength
- WONDER spatial structures such as CASCADE / ROUND actually participating during playback

No offline growth.
No progress while stopped.
No progress from simply parking objects near each other.

Preserve Garden v1 and Growth v1 compatibility. If new state is needed, add a separate versioned WEAVE persistence key rather than mutating source artwork or breaking existing saves.

---

# v0.7 relationship motifs

Implement a curated first set. These are not rewards and should not be named in normal UI.

## 1. Pair relationship → SHARED PATCH

When two works have accumulated enough shared musical evidence, create a small shared environmental mark in the space **between their CLEARING exclusion zones**.

The mark depends on the pair's musical roles.

Suggested mappings:

- melody + harmony → small flower/bloom patch
- melody + drone → soft grass / wash bridge
- melody + rhythm → sparse seed trail
- melody + decoration → tiny star-speck / light patch
- harmony + drone → low rounded meadow patch
- rhythm + decoration → dotted seed + sparkle mix
- other stable pairs → restrained neutral leaf/seed patch

Important:

- the shared patch must belong to the **space between works**, not overlap either drawing
- it should be deterministic from pair IDs
- it should sit behind all artwork and local habitats
- it should not look like a reward icon or collectible

Suggested thresholds may reuse relation shared-beat milestones but should be tuned visually:

- first relationship memory: around current GROW relation stage 1
- clearer shared patch: stage 2
- mature shared patch: stage 3

Do not add new numeric progression UI.

---

## 2. Repeated pair exchange → GENTLE PATH

A mature pair relation may produce a soft path between the two CLEARING edges.

Unlike the old center-to-center relation curve:

- start from the outward edge of each artwork's exclusion ellipse
- avoid crossing artwork bounds
- use low contrast and ground-like rendering
- allow slight deterministic curvature
- do not render every possible pair at equal weight

At high object counts, show only the most musically established paths.

Recommended visible persistent path cap: **6–8** at 12 objects.

If more relationships exist, keep their data but suppress lower-priority visual paths.

Priority can use:

1. sharedBeats
2. current proximity / relevance
3. deterministic ID tie-break

---

## 3. CASCADE history → SEED TRAIL

If 3+ works repeatedly participate in WONDER CASCADE while actually sounding in sequence:

- a subtle ordered trail can appear along the spatial route
- use seeds, dots, tiny leaves, or small ground dashes
- emphasize direction through spacing/order, not arrows

The trail should never remain if it makes the Garden look diagrammatic.

The user's likely interpretation should be:

> “something has traveled through here”

not:

> “this is a flowchart.”

A one-off accidental lineup should not create persistent scenery. Require repeated musical evidence.

---

## 4. ROUND history → CENTER CLEARING

If 3 works repeatedly perform a stable WONDER ROUND:

- create a faint shared patch near the triangle's interior
- use a soft watercolor bloom / flower cluster / tiny circular meadow depending role mix
- keep it below all three drawings and outside their exclusion ellipses

The center mark should make the triangle feel like a little place that exists because the three works have sung together.

When the triangle is later moved apart, persistent history may remain only if v0.7 state explicitly stores that relationship memory. If persistence is not added in the first implementation, keep the mark derived from current placement + accumulated evidence and document that limitation.

Do not fake abandoned history from object positions without a stored anchor.

---

# Negative space budget

This is a strict visual requirement.

At mature 12-object Garden:

- at least ~45% of the field should remain visually quiet background at a glance
- no artwork exclusion zone may contain persistent WEAVE imagery
- no more than 8 persistent pair paths
- no more than 3 persistent multi-object motifs (cascade/round) should be visually strong at once
- when motifs overlap, merge/fade/suppress instead of stacking opacity

The Garden must keep breathing.

---

# Spatial geometry

Reuse / centralize CLEARING geometry.

Every work should expose or derive an exclusion ellipse / safe region based on its rendered artwork footprint.

WEAVE geometry must use safe-region boundaries, not centers.

For a path between A and B:

1. compute normalized vector from A to B
2. find A ellipse boundary in that direction
3. find B ellipse boundary in reverse direction
4. use those points as path endpoints
5. curve around other exclusion regions when cheap; otherwise suppress the path if it intersects a third work too strongly

Do not implement a heavyweight routing engine in v0.7.

A conservative rule is preferred:

> if a relationship path would visually cut through another drawing, omit it.

---

# Musical-role visual vocabulary

Reuse CLEARING assets where useful.

Current local role language:

- melody → sprouts
- harmony → flowers
- drone → grass
- rhythm → seeds
- decoration → stars

WEAVE combines these rather than inventing a second unrelated art style.

Examples:

- melody + harmony shared patch = 1–3 small flowers with sprouts
- melody + rhythm = curved seed trail
- drone + decoration = grass edge with sparse stars

Keep shared imagery smaller and quieter than the local habitat around a mature object.

---

# ALIVE integration

Persistent WEAVE landscape is calm.

When the relationship actually sounds:

- the relevant shared patch may brighten slightly
- a path may carry one short soft traveling pulse
- a ROUND center patch may breathe once when the lead rotates
- a CASCADE trail may light sequentially in the actual musical order

These reactions must be driven by the same real GardenLifeEvent / transport timing used by ALIVE.

Do not add independent beat timers that guess musical order.

Reduced Motion:

- no traveling motion
- use brief color/opacity emphasis at endpoints and shared patch
- retain semantic visibility of which relationship sounded

---

# Interaction behavior

## Moving a work

While dragging:

- transport continues
- persistent WEAVE geometry updates smoothly but cheaply
- do not create/destruct persistent relationship history during every pointermove
- relationship qualification remains beat/evidence based

The landscape should feel elastic, not recalculated as a series of hard jumps.

## Selecting a work

Selection may gently emphasize its strongest 1–3 relationship landscape features.

Do not fade the rest of the Garden so aggressively that the world disappears.

## Listener movement

Listener movement changes what is audible and therefore what can accumulate future relationship evidence.

It should not directly repaint persistent WEAVE history.

---

# Persistence options

Prefer one of these two implementations, in order:

## Option A — derive from existing Growth v1 relation data

Use `growth.relations[pair].sharedBeats` plus current positions to render pair patches / paths.

Advantages:

- no migration
- simple
- enough to test pair landscape hypothesis

Limitation:

- if objects move, old relationship landscape moves with them
- no historical geographic memory

This is acceptable for v0.7 if clearly documented.

## Option B — separate `picture-score:weave:v1`

Only if needed for CASCADE/ROUND anchors or historical landscape.

Never mutate Project / Stroke / Score / Music IR.

Corrupt WEAVE state must be discardable without harming Garden or Growth saves.

---

# Rendering architecture

Add a dedicated `WeaveLayer` beneath local GrowthLayer or integrate carefully if visual ordering is easier.

Recommended stacking:

1. watercolor background
2. **WEAVE shared landscape**
3. local CLEARING / GROW habitats
4. temporary ENSEMBLE / ALIVE relation feedback
5. artworks
6. listener / controls

Requirements:

- pointer-events none
- deterministic output
- no unbounded DOM growth
- cap motifs
- no canvas particle simulation
- SVG/CSS/image assets are preferred
- responsive geometry must be stable between desktop/mobile

---

# Density / collision rules

At 12 objects:

- pair motif candidate cap can be larger internally, but rendered motifs are capped
- if two shared patches overlap heavily, keep the stronger one or merge opacity rather than drawing both
- if a shared patch collides with an artwork exclusion region, shift along the pair's perpendicular axis using deterministic offset
- if no clean position exists, suppress it
- if a path intersects another artwork, suppress or reroute with a single quadratic control point only

Never compromise drawing readability to display relationship history.

---

# What not to add

Not in v0.7:

- XP / levels / relationship meters
- friend/romance metaphors
- semantic object recognition
- new WONDER secret laws
- inventories / collectible plants
- terrain editing
- multiple Garden maps
- autonomous creatures
- weather/day-night
- social features
- procedural world generation

WEAVE is about **visible musical relationship memory**, not adding a new game system.

---

# Acceptance criteria

## Visual

1. With 12 mature works, every drawing remains readable at a glance.
2. Pair growth never enters either artwork's exclusion zone.
3. Persistent path count is visibly bounded.
4. The Garden contains meaningful relationship scenery but still has obvious quiet background regions.
5. No persistent motif looks like a technical graph connector.

## Musical truth

6. A pair that never actually shares audible musical evidence does not gain a relationship landscape merely from proximity.
7. Shared scenery reacts only when the corresponding relationship actually sounds.
8. CASCADE / ROUND reaction order matches real transport events.
9. STOP / hidden tab freezes all new evidence accumulation.

## Regression

10. DRAW behavior unchanged.
11. Garden transport never restarts on drag.
12. ENSEMBLE / GROW / PLAYGROUND / WONDER / ALIVE / CLEARING remain functional.
13. Garden v1 and Growth v1 saves still load.
14. PNG/WAV/MIDI/JSON behavior remains unchanged.
15. Reduced Motion preserves meaning without traveling animation.

## Performance

16. 12-object Garden remains interactive on 390×844 target width.
17. No per-frame React state loop for persistent WEAVE rendering.
18. No unbounded relationship DOM nodes or particles.

---

# Required QA scenes

Capture / verify at least:

### Scene A — pair
- two works far apart
- bring together and let them actually ensemble
- observe shared patch only after sufficient musical evidence
- move apart and verify readability

### Scene B — crowded six
- six mature works
- multiple possible relationships
- verify priority/caps and no dark knots

### Scene C — full twelve
- twelve mature works
- at least 6 pair relationships
- verify negative-space budget and artwork readability

### Scene D — cascade
- 3–4 aligned works
- repeated CASCADE
- verify sequence-linked seed trail / temporary lighting

### Scene E — round
- three stable triangle works
- repeated ROUND
- verify subtle center patch and actual lead rotation feedback

### Scene F — reduced motion
- same scenes with reduced motion enabled
- meaning remains clear through color/opacity only

---

# Product test

Give someone a Garden with several mature relationships and no explanation.

Success is if they notice the space **between** drawings and start rearranging objects to see what kind of place appears.

Best spontaneous reactions:

> 「この2つ、一緒にいるとここが変わる」
>
> 「じゃあ、この3つ並べたら？」

That is WEAVE.
