# Picture Score Garden v0.2 — ENSEMBLE

## Theme

**Placement becomes arrangement.**

Garden v0.1 proved that Picture Score artworks can live in a shared 2D world, share a transport, fade with listener distance, and remain musically bounded.

v0.2 must make placement matter musically beyond volume.

The user should be able to move one drawing closer to another and hear the relationship change:

- two melodies begin taking turns
- a drone starts supporting a melody
- harmony enters beneath a nearby phrase
- decoration fills gaps instead of talking over everything
- moving objects apart dissolves the relationship again

The desired reaction is:

> 「このふたつ、近くに置いたら一緒に歌う。」

Do not add progression, rewards, quests, currencies, social systems, AI generation, or semantic image recognition.

---

## Product goal

Garden v0.2 should validate this loop:

**Draw → Place → Hear relationship → Move → Hear a different relationship → Notice an empty musical space → Draw again**

The important new step is **Move → Hear a different relationship**.

If moving an artwork around the Garden feels like arranging music, v0.2 succeeds.

---

# 1. Ensemble Relationships

Add a world-level relationship layer above the existing role classifier and mixer.

Nearby artworks should form temporary ensembles.

A relationship is based on:

- distance between artworks
- inferred musical roles
- listener audibility
- shared 16-beat phrase clock

Do not permanently rewrite the source Project / Stroke IR / Score IR / Music IR.

Suggested concept:

```ts
interface EnsembleRelation {
  a: string
  b: string
  strength: number // 0..1 from spatial proximity
  kind:
    | 'call-response'
    | 'support'
    | 'pulse-fill'
    | 'sparkle-fill'
    | 'shared-bed'
}
```

Relations may be derived every mix/update cycle and do not need persistence.

---

# 2. Proximity must affect arrangement

Use object-to-object distance, not just listener-to-object distance.

Suggested normalized thresholds:

- > 0.34: independent
- 0.22–0.34: weak relationship
- 0.10–0.22: clear ensemble
- < 0.10: strong ensemble

These are starting points only. Tune by listening.

Relationship strength must transition smoothly when objects move. Never pop or restart the whole transport.

Quantize meaningful arrangement changes to the next beat or bar where practical.

---

# 3. Role-pair behavior

Implement deterministic heuristics first.

## melody + melody

Prefer **call and response** over simultaneous full phrases.

- alternate 4-beat or 8-beat windows
- preserve each drawing's recognizable contour
- never permanently mute one melody
- at weak relation they can overlap lightly; at strong relation they should converse more clearly

Desired feeling:

> one picture asks, the other answers

## melody + harmony

Harmony supports melody.

- harmony should enter under phrase starts / strong beats
- reduce harmony density if it masks the melody
- stronger proximity may increase harmonic presence, not raw loudness only

## melody + drone

Drone becomes a bed.

- sustain beneath the melody
- keep gain modest
- avoid retriggering the drone too frequently

## melody + rhythm

Rhythm should fill space around the melody.

- prefer off-beats / gaps
- do not duplicate every melodic event

## melody + decoration

Decoration should answer phrase endings or quiet gaps.

## harmony + drone

Allow a shared harmonic bed, but cap low/mid density.

## rhythm + decoration

Can coexist, but keep total event density bounded.

Other pairs may use conservative fallback behavior.

---

# 4. Phrase windows

Garden already uses a 16-beat loop. Build the ensemble logic around this rather than creating another clock.

Recommended structure:

- 16-beat world phrase
- four 4-beat windows
- relationships can assign or weight windows

Examples:

```txt
melody A: 1–4, 9–12
melody B: 5–8, 13–16
harmony: strong beats under currently active melody
sparkle: phrase endings
```

Do not force every work into this exact pattern. Preserve relative timing and contour where possible.

The arrangement layer should decide **when a work speaks**, more than rewriting **what it says**.

---

# 5. Spatial movement as live arranging

Dragging an artwork while Garden is playing should be one of the headline interactions.

Requirements:

- audio keeps running
- listener position remains unchanged
- distance gain continues to update smoothly
- ensemble strength changes smoothly
- relationship changes enter without clicks
- no transport reset
- source artwork is not mutated

The user should be able to drag a drawing toward another one and hear them start cooperating.

This is the central v0.2 tactile test.

---

# 6. Visual life, very restrained

Placed artworks should feel alive without becoming animated stickers.

Add only subtle feedback:

### Audible state
Artwork gently breathes/pulses with the shared beat when it is currently sounding.

### Ensemble state
When an artwork is selected, show its current nearby musical partners with a very faint temporary relationship cue.

Preferred options:

- thin curved line
- soft shared halo
- tiny connecting dots

Only show this for the selected artwork or during movement. Do not leave a permanent network graph on screen.

### Placement bloom
When a new artwork is placed and joins the next beat, give it one small visual bloom synchronized to its first sound.

No confetti, particles, score popups, rarity effects, or reward UI.

---

# 7. Garden status language

The UI may gently describe what is happening, but do not turn it into a technical mixer.

Examples:

- 「猫と星が、交代で歌っている。」
- 「山が、ハートをそっと支えている。」
- 「少し離すと、それぞれの歌に戻る。」

Use role-based language if no semantic artwork names exist.

A simple selected-object status line is enough.

Do not expose relation matrices, numerical distances, or orchestration scores in normal UI.

Development-only data attributes are fine.

---

# 8. Preserve the quiet Garden

The existing visual direction is good: paper-like, spacious, calm, with user drawings as the main content.

Do not fill the landscape with decorative assets yet.

The empty space is intentional. It creates the thought:

> 「ここに何か置きたい。」

Keep landmarks subtle and non-interactive for v0.2.

---

# 9. Architecture

Keep the current Garden modules and add a small arrangement layer rather than rewriting transport.

Suggested additions:

```txt
src/garden/
  ensemble.ts
  ensemble.test.ts
```

Possible APIs:

```ts
export interface EnsemblePlan {
  relations: EnsembleRelation[]
  objectPlans: Map<string, ObjectArrangementPlan>
}

export interface ObjectArrangementPlan {
  phraseGain: number
  activeWindows: number[]
  roleWeight: number
  relationStrength: number
}

export function buildEnsemblePlan(
  state: GardenState,
  listenerMix: Map<string, number>,
  phraseIndex: number,
): EnsemblePlan
```

`gardenMixer.ts` remains responsible for bounded gain/role caps.

`gardenTransport.ts` consumes the arrangement plan to decide scheduling windows / event emphasis.

Avoid rebuilding the AudioContext graph per frame.

---

# 10. Determinism

The same Garden state at the same phrase index should produce the same arrangement.

Do not use uncontrolled `Math.random()` in orchestration.

If variation is desired, derive it from stable object ids + phrase index.

This keeps testing and replay understandable.

---

# 11. Performance

Mobile remains the target.

- max 12 artworks
- relation computation is trivial O(n²) at this scale
- do not schedule a new timer per relation
- reuse the existing shared transport/lookahead
- update relation strength at a modest interval or on state changes, not every animation frame
- visual connection rendering should be cheap SVG/CSS

DRAW responsiveness must not regress.

---

# 12. Acceptance criteria

Garden v0.2 is successful when:

1. Two melody artworks placed far apart sound independent.
2. Moving them close makes them audibly converse rather than merely become louder.
3. Moving a drone/harmony object near a melody audibly supports it.
4. Moving the same support object away dissolves that support smoothly.
5. Dragging while playing never restarts the global transport.
6. Dense 8–12 object clusters remain bounded and non-chaotic.
7. Selected artwork can reveal, subtly, which nearby artworks it is currently relating to.
8. Placement produces a small synchronized arrival response.
9. Existing v0.1 persistence remains compatible.
10. DRAW v0.3 behavior and exports remain unchanged.

---

# 13. QA scenarios

## A. Melody duet
Create two smooth curved drawings classified as melody. Place far apart, then move together while playing.

Expected: transition from independent phrases to clear call/response.

## B. Melody + long horizontal drawing
Expected: horizontal work behaves as supportive bed when near.

## C. Melody + vertical/chord-heavy drawing
Expected: harmonic support increases when close, without masking melody.

## D. Live drag
Drag one active artwork repeatedly near/far for 20–30 seconds.

Expected: no clicks, transport restart, runaway voices, or stale relationship state.

## E. Dense cluster
8–12 varied works in one region.

Expected: bounded mix, role caps respected, some works rest naturally.

## F. Three regions
Create three separated clusters.

Expected: listener movement and object proximity both affect what is heard. Each region feels compositionally distinct.

## G. Persistence / compatibility
Reload a Garden saved by v0.1.

Expected: loads successfully and receives v0.2 ensemble behavior without migration loss.

## H. Mobile
390×844 touch: drag object while playing, select relation cue, move listener, DRAW/GARDEN round-trip.

---

# 14. Explicitly out of scope

Do not implement yet:

- semantic recognition (cat/tree/etc.)
- AI composition
- seasons/weather
- SylphNote integration
- public/shared Gardens
- multiplayer
- social graph
- achievements or progression
- inventory
- currencies
- unlock systems
- large maps
- 3D
- complex environmental simulation

---

# North star

v0.1 answered:

> 「絵を世界に置けるか？」

v0.2 must answer:

> **「置く場所を変えるだけで、音楽を編曲している感覚になるか？」**

The Garden should not simply contain songs.

**The Garden itself is the instrument.**
