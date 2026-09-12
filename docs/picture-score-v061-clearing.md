# Picture Score v0.6.1 — CLEARING

> **Growth frames the drawing, never covers it.**
>
> 育つほど、絵が埋もれるのではなく、絵の居場所ができていく。

## Problem

ALIVE succeeded in making placed drawings feel like inhabitants, but the current GROW marks originate too close to each artwork center and relation paths begin/end at artwork centers. As growth matures, habitat strokes increasingly overlap the user's line art.

This breaks the visual hierarchy:

1. user drawing must remain the star
2. growth should make a place for it
3. relation memories should connect places, not draw through inhabitants

CLEARING changes only the rendering/layout of persistent growth. Do not change GROW counters, thresholds, persistence keys, audio logic, ENSEMBLE, WONDER, or source IR.

---

## North star

A mature object should look **more settled and more readable** than a fresh object.

The user should see:

- a clear drawing in the middle
- a small habitat around it
- paths arriving at the habitat edge
- enough open paper that several objects can coexist

Never let maturity visually bury the artwork.

---

# 1. Protected artwork clearing

Every placed artwork owns a visual exclusion zone in the GROW layer.

For v0.6.1 use a deterministic approximate footprint rather than DOM measurement or per-frame layout reads.

Suggested normalized SVG-space radii on the 1000 × 1000 GrowthLayer:

- mobile-friendly baseline safe radius: 58
- wide drawings / canvasAspect > 1.8: horizontal radius 76, vertical radius 52
- otherwise: horizontal radius 62, vertical radius 58
- add 8–12 units of breathing room for stage 3

No persistent growth geometry may be emitted inside this ellipse except a very low-opacity ground wash if one already exists.

Do not clip the user drawing. Only redirect / mask growth.

---

# 2. Habitat grows outward

Current marks begin near the owner center. Replace that pattern with ring / perimeter anchors.

For each deterministic mark:

- choose a stable angle from object id + mark index
- start at the clearing ellipse perimeter
- extend outward, never inward
- stage 1 uses 2–3 small marks
- stage 2 fills more angles
- stage 3 adds density farther away rather than toward the center

Suggested role body language:

- melody: short curved stems/leaves that lean outward
- harmony: soft filled oval/rosette patches outside the clearing
- drone: long calm arcs tangent to the clearing, not radial lines through it
- rhythm: seed dots / short dashes distributed around the perimeter
- decoration: tiny stars/specks outside the perimeter

Prefer filled or softly stroked ground marks over high-contrast linework when possible. Growth must read as habitat/ground, not another drawing competing with the user's drawing.

---

# 3. Relation paths stop at habitat edges

Persistent GROW relation paths must not start at object centers.

For a relation A → B:

1. calculate vector A→B
2. move the A endpoint outward from A by A's safe ellipse radius along that vector
3. move the B endpoint outward from B by B's safe ellipse radius in the opposite direction
4. draw the curved path only between those edge points

If objects are so close that the clearings overlap, shorten/fade the persistent path rather than drawing through either artwork.

WONDER/ENSEMBLE transient relationship light may remain separate, but it also should avoid obscuring the line art where practical.

---

# 4. Growth density budget

The mature Garden should feel richer without becoming visually noisy.

Keep existing hard caps, but reduce local density near artwork:

- no more than 8 persistent habitat marks per object
- no more than 24 mature relation paths total
- no persistent mark directly behind the artwork's protected clearing
- stage 3 expands radius before increasing stroke weight

At 12 objects, empty paper must still remain clearly visible.

---

# 5. ALIVE reactions

When an artwork emits sound:

- its habitat may briefly brighten or breathe at the perimeter
- never animate marks across the drawing itself
- relation travel should appear to leave from / arrive at the habitat edge

Reduced-motion mode uses color/opacity only.

---

# 6. Acceptance criteria

## A. Readability

With stage-3 growth, the original drawing remains visually readable without selection highlight.

Test with:
- cat/face-like dense drawing
- wide wave
- small star
- vertical tall shape

## B. Mature habitat

Stage 3 visibly looks more developed than stage 1, but growth occupies the surrounding ground rather than the drawing interior.

## C. Relation path

Two mature works connected by a GROW path show no path segment under either drawing's protected central area.

## D. Close pair

When two artworks are placed very close together, persistent growth does not create a dark knot between/under them. Fade or omit conflicting growth geometry.

## E. Regression

Preserve:
- GROW beat counters and thresholds
- Growth v1 persistence
- Garden v1 persistence
- Stroke / Score / Music IR
- ENSEMBLE transport continuity
- WONDER rules and visual life events
- DRAW PNG/WAV/MIDI/JSON behavior

---

# Product test

Compare the same Garden at growth stage 0 and stage 3.

Success is not:
> 'There are more marks.'

Success is:
> **'This drawing has made a little place for itself.'**
