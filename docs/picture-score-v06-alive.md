# Picture Score v0.6 — ALIVE

> **Your drawings don’t sit there. They live there.**

## Goal

v0.6 turns Garden from a clever spatial music editor into a living musical playground.

The current system already has the hard parts:

- shared transport and synchronized playback
- proximity-based ENSEMBLE
- GROW traces based on actually heard music
- PLAYGROUND tap/spotlight/listener feedback
- WONDER rules such as loop, spark, cascade, and round

ALIVE must connect those systems to visible, tactile behavior so the user can understand the music by watching and touching the drawings themselves.

The target reaction is:

> “That cat is singing.”
> “Those two noticed each other.”
> “The sound ran through the three drawings.”
> “I want to poke this one.”
> “I want to put another drawing over there.”

The decisive change is conceptual:

**Do not render a placed work as a card that happens to play music. Render it as a drawing that has been released into the Garden.**

---

# Product principles

## 1. The drawing itself is the actor

The original line art is always the visual identity.

Do not replace it with a mascot, generated sprite, semantic illustration, card chrome, or icon.

Animation should deform or decorate the drawing only temporarily and gently enough that it remains recognizable.

## 2. Motion must correspond to sound

Do not add idle motion everywhere simply to look lively.

The strongest motion should be event-driven:

- a note starts → the drawing reacts
- a sustained note continues → a calm held motion
- two works enter a relationship → they react to each other
- cascade/round advances → visible focus travels through the spatial formation
- growth reaches a stage → habitat visibly opens

The user should be able to infer which object produced a sound.

## 3. Quiet state and alive state must be visibly different

When Garden is stopped, drawings may have only a very small resting presence.

When the Garden plays, it should become obviously alive within one bar.

Do not make the user stare closely to notice the difference.

## 4. No semantic recognition

A cat drawing must not move because the app recognizes “cat”.

Behavior comes from:

- musical role
- note timing / duration / velocity / pitch movement
- ENSEMBLE relationship
- WONDER formation/rule
- GROW state

This keeps the core promise intact: **the way it was drawn determines the way it lives.**

## 5. No gamification wrapper

Still no XP, levels, hunger, health, collectible rarity, coins, daily tasks, pet-care loops, or unlock economy.

The reward is direct response and an increasingly personal Garden.

---

# A. Replace “artwork card” presence with “inhabitant” presence

The Garden currently needs labels/selection affordances for usability, but the default visual should no longer read as a UI card.

## Default state

For an unselected object:

- show the drawing prominently
- no permanent border/card background
- hide title/role label unless selected, focused, or needed for accessibility
- keep a generous invisible hit area around the drawing for touch
- growth remains behind the drawing

## Selected state

Selection may reveal a lightweight halo + compact label/action row.

Do not put every object in a rounded rectangle.

### Hit target

Visual drawing may be small, but interactive target should remain at least ~44 CSS px in each dimension on mobile.

The invisible hit target must not block nearby drawings unnecessarily.

---

# B. Music-driven life events

Add a read-only UI event bridge from GardenTransport.

The transport already knows every emitted note and active lane. Do not independently guess sound timing from React timers.

Suggested event shape:

```ts
export interface GardenLifeEvent {
  objectId: string
  type: 'note' | 'sustain-start' | 'sustain-end' | 'relation' | 'spotlight' | 'tap'
  beat: number
  pitch?: number
  velocity?: number
  duration?: number
  layer?: 'free' | 'ensemble'
}
```

Suggested API:

```ts
onLifeEvent?: (event: GardenLifeEvent) => void
```

Requirements:

- event is observational only
- must never affect scheduling or audio timing
- do not create React state updates for every oscillator/harmonic
- emit once per logical musical note, not once per oscillator
- cap UI event rate for pathological dense drawings
- no catch-up burst after a stalled frame
- stopping or hiding the page clears transient life state

The existing `onHeard` remains dedicated to GROW accounting.

---

# C. Role-specific body language

Each musical role gets a distinct motion vocabulary.

Keep transforms small. The drawing is not rubber.

## melody — sing / rise

On note attack:

- gentle upward lift, around 3–7 px equivalent
- very small scale expansion
- pitch direction may bias the tilt/lift direction

During legato phrases, transitions should feel connected rather than repeated punching.

Desired feel: the drawing is singing a phrase.

## harmony — open / bloom

On chord attack:

- brief wider scale, e.g. X 1.04–1.08 / Y 1.02–1.04
- soft surrounding ring/rosette response

Multiple chord notes at the same attack should produce one visual bloom, not three competing animations.

## drone — breathe / sway

For sustained notes:

- slowly expand/contract or sway by a few degrees
- sustain duration controls how long it holds
- avoid rhythmic bouncing

Desired feel: a stable presence supporting the space.

## rhythm — hop / tap

Short events:

- small quick vertical hop or squash
- crisp, short recovery

Must remain low-amplitude enough that dense rhythm does not vibrate chaotically.

Rate-limit visible hops if event density is extreme.

## decoration — sparkle / flick

Short ornamental event:

- tiny local flash/star/dot near the drawing
- optional 1–2 very short particles maximum

Do not create continuous particle systems.

---

# D. Attack should travel through the drawing

A whole-object scale pulse is useful but not enough.

Where practical, map the current musical event back toward source geometry using existing PlayNote source IDs / anchor IDs / score note positions.

For an active note:

- highlight the source segment/representative point briefly
- let a small warm highlight travel along connected phrase notes
- keep nonactive strokes visible

This can be approximate in v0.6.

Do not mutate Stroke IR or Score IR.

If precise source mapping would significantly destabilize the renderer, use role-level motion first and implement a deterministic representative highlight from PlayNote anchors.

---

# E. Direct touch interactions

PLAYGROUND already has tap audition and Spotlight. ALIVE should make these feel embodied.

## Tap → one voice

Quick tap on a placed drawing:

- drawing compresses immediately on pointerdown
- release produces short audition
- visible answer comes from the drawing, not from a detached toast
- if Garden is running, quantize safely to shared clock as existing implementation does

## Long press → temporary SOLO / Spotlight

Replace or supplement the text-heavy selection flow with an optional discoverable long press.

Suggested:

- hold ~420–550ms without moving
- tactile tick if supported
- selected object gets 4 beats of Spotlight
- nearby parts duck, not mute
- visible halo/spotlight is bold enough to understand
- release does not drag the object

Keep the accessible Spotlight button for keyboard/screen-reader operation.

Do not make long press the only path.

## Drag → “sing through space”

Dragging an object while playing must continue to change ENSEMBLE and distance mix without restarting transport.

Add restrained drag sonification:

- do NOT retrigger full phrase continuously
- optional tiny quantized tick only when crossing a meaningful relation threshold or spatial zone
- relation thread stretches and reacts
- if a strong relationship forms, both drawings answer visually/audio once as PLAYGROUND already supports

Avoid noisy scrub audio.

---

# F. Relationships must look alive

ENSEMBLE currently has relation threads. ALIVE should make relation type legible through behavior without turning the Garden into a graph editor.

## call-response

When A sings, A leans/brightens toward B very slightly.
When B answers, the visual emphasis passes to B.

The thread can carry a single moving highlight from speaker to listener.

## support

Supporting object expands softly underneath/behind the lead.
The lead remains visually dominant.

## pulse-fill

Rhythm object answers in the empty spaces with small taps.

## sparkle-fill

Decoration emits a tiny visual spark near the lead during the gap.

## shared-bed

Both objects breathe in a related slow cycle without becoming perfectly synchronized clones.

No permanent arrows or relation labels are required for normal play.

---

# G. WONDER rules become visually undeniable

Do not add more secret rules in v0.6. Make the existing ones satisfying.

## closed shape → LOOP

When its local repeat happens:

- one highlight travels around the closed contour
- start/end join gives a tiny elastic pulse
- no giant LOOP badge

## retrace → THICKEN

When a thickened phrase plays:

- layered strokes glow with a slightly broader echo/shadow for the duration
- visual richness should correspond to the capped musical thickening stage

## crossing → SPARK

At the crossing time:

- spark occurs at/near the intersection, not at the center of the whole artwork
- 1 compact flash only
- respect existing per-bar cap

## mirror → ANSWER

First side/half lights, then matching side responds.

The user should be able to see the “question → answer” structure.

## lineup → CASCADE

When cascade is active, a visible focus travels through objects in the same order as the music.

Each object gets one attack response as its turn arrives.

The connecting cue may be a short moving dot/streak, not a permanent bright line.

## triangle → ROUND

The lead visibly rotates A → B → C in exact musical order.

A faint triangular relation may appear during the round, but only while active.

---

# H. GROW becomes a habitat, not wallpaper

GROW is already deterministic and persisted. Keep that model.

ALIVE changes how mature growth participates visually.

Requirements:

- stage 1 clearly noticeable around an object in normal phone use
- stage 2 gives the object a local “place” or habitat
- stage 3 makes that region visibly established
- relation growth paths should look grown rather than diagrammatic
- growth may react briefly when its owner sounds, but must not animate continuously

Examples by role:

- melody habitat stems lift slightly when the melody sings
- harmony rosette opens on chord attack
- drone grass/rings sway on sustain
- rhythm seeds pop subtly on pulse
- decoration marks twinkle on ornament

Do not persist animation phase. Only persisted beat counters remain source of growth state.

---

# I. Listener becomes part of the play

Keep the listener as an abstract listening orb/ear, not a mascot.

While moving:

- nearby objects visually wake as they enter audible range
- distant ones settle
- short fading trail remains
- proximity ring may expand/contract subtly with currently audible field

Optional:

- color blend of the orb can reflect the dominant nearby role

Do not add speech/dialogue/personality.

---

# J. Garden visual hierarchy

Recommended render order:

1. landscape / ground
2. persistent GROW habitat and paths
3. ephemeral relationship / WONDER formation visuals
4. artworks / inhabitants
5. local note/spark/highlight effects
6. listener
7. selection/accessibility chrome

The Garden should read first as a world, second as an editor.

Titles and role labels should not be visible for every object simultaneously unless accessibility or a specific mode requires it.

---

# K. Technical architecture

Prefer extracting life presentation out of `GardenView.tsx` rather than making that component even larger.

Suggested modules:

```txt
src/garden/
  life.ts                 # event types, role motion mapping, rate limits
  GardenLifeLayer.tsx     # ephemeral relation/WONDER/world effects
  GardenArtwork.tsx       # placed drawing + hit target + local life visuals
  GardenView.tsx          # orchestration and interaction state
```

Possible transient state:

```ts
interface ObjectLifeState {
  lastAttackAt: number
  pitch?: number
  velocity: number
  duration: number
  role: MusicalRole
  mode: 'rest' | 'attack' | 'sustain' | 'spotlight'
}
```

Do not persist life state.

Do not add life fields to Project, StrokeIR, ScoreIR, or MusicIR.

## Transport changes

`GardenTransport.emit()` is the cleanest source for note events.

Emit a logical event before/after scheduling `voice()`.

Use AudioContext time in the payload if helpful so UI can compensate for lookahead and schedule CSS/Web Animation close to the audible attack.

If implementing scheduled visual timing:

- convert AudioContext target time to a bounded `setTimeout`
- discard stale events
- clear timers on STOP/page hide
- do not let visual scheduling block audio scheduling

---

# L. Animation implementation policy

Current dependency set is deliberately small. Keep it that way unless evidence says otherwise.

Preferred order:

1. CSS transforms / keyframes
2. Web Animations API for attack-timed one-shots
3. React state only for coarse modes / IDs
4. add a motion library only if implementation becomes materially simpler and bundle impact is documented

Do not add Rive, PixiJS, canvas game engines, or physics libraries for v0.6.

Performance target:

- 12 artworks can play on a mid-range phone without obvious UI jank
- no per-frame React render loop for all objects
- no large particle arrays
- no layout thrashing during audio playback
- transforms/opacity preferred

---

# M. Reduced motion and accessibility

`prefers-reduced-motion: reduce` must preserve musical information without continuous movement.

Reduced-motion alternatives:

- attack = brief color/outline change
- sustain = stable soft halo
- relationship speaker change = color emphasis transfer
- cascade/round = sequential outline highlight

No required information may exist only in motion.

Keyboard:

- Enter/Space still auditions an object
- arrow keys still move it
- Spotlight remains focusable

Screen-reader labels continue to expose title and musical role even if visible labels are hidden by default.

---

# N. Audio and visual safety bounds

ALIVE is primarily visual/tactile. Do not accidentally make the mix louder.

- existing mixer total budget remains authoritative
- tap/relationship UI tones stay bounded
- life effects do not duplicate the underlying musical notes
- dragging never machine-guns audition notes
- dense rhythm visual events are rate-limited
- decorative sparks maximum ~2 simultaneously per artwork

---

# O. Implementation milestones

## ALIVE 1 — Event bridge

- add `GardenLifeEvent`
- transport emits logical note events
- no audio timing regression
- unit tests for event ordering/rate bound/stop cleanup

## ALIVE 2 — Inhabitants

- extract GardenArtwork
- remove default card-like presence
- role-specific attack/sustain animations
- title/role shown only selected/focused
- 44px mobile hit target retained

## ALIVE 3 — Touch

- tap answer polish
- accessible long-press Spotlight while preserving button path
- drag threshold feedback without transport restart

## ALIVE 4 — Relationships + WONDER

- call/response emphasis transfer
- support/fill/shared-bed behaviors
- loop contour cue
- crossing spark
- mirror answer
- cascade and round visible sequencing

## ALIVE 5 — GROW habitat

- stronger stage readability
- role-linked habitat reaction
- mature relation paths feel organic

## ALIVE 6 — QA / tuning

- mobile timing and jank
- dense 12-object case
- reduced motion
- language switching
- persistence/export regression
- real-device subjective play test

---

# P. Acceptance criteria

v0.6 is successful only if all are true:

1. With Garden playing, a user can tell which drawing just made a sound without reading labels.
2. Different musical roles visibly behave differently.
3. Stopped Garden and playing Garden feel clearly different within one bar.
4. Unselected drawings no longer primarily read as UI cards.
5. Tapping a drawing produces an immediate embodied response.
6. Spotlight can be triggered accessibly and returns to normal automatically.
7. Dragging while playing never restarts the transport.
8. Strong ENSEMBLE call/response can be followed with the eyes as well as ears.
9. WONDER cascade/round order is visually identical to musical order.
10. LOOP / SPARK / ANSWER each have a distinct localized visual response.
11. GROW stage changes are noticeable on 390×844 without zooming.
12. Existing Garden v1 + Growth v1 saves load unchanged.
13. Stroke/Score/Music IR are unchanged by life presentation.
14. WAV/MIDI/PNG/JSON behavior remains valid.
15. `prefers-reduced-motion` remains understandable and usable.
16. 12-object playback does not create runaway DOM nodes or obvious frame collapse.
17. Page hide/STOP removes transient animations and scheduled visual callbacks.
18. Japanese/English switching does not restart playback or lose state.

---

# Q. QA scenarios

## 1. One object, five roles

Use deterministic test fixtures for melody/harmony/drone/rhythm/decoration.
Confirm each role has distinguishable body language.

## 2. Tap / long press / drag

On 390×844 touch emulation and physical phone:

- short tap = audition
- long press = Spotlight, no accidental drag
- drag = move, no accidental tap/Spotlight
- pointer cancel cleans state

## 3. Call and response

Place two melodies close.
Run at least 20 seconds.
Confirm visible speaker emphasis alternates with actual 8-beat windows and transport identity remains unchanged.

## 4. WONDER lineup

Place 3 works in a line.
Confirm cascade visual order and sound order match.
Move one out of alignment while playing and confirm both dissolve without restart.

## 5. WONDER triangle

Move same 3 works into triangle.
Confirm round lead visibly rotates in the same order as music.

## 6. Closed/crossing/mirror DRAW work in Garden

Place works containing existing WONDER structures.
Confirm LOOP/SPARK/ANSWER visual moments appear only at the corresponding musical moments.

## 7. Growth

Advance fixture counters or listen enough to reach stages 1/2/3.
Confirm habitat is obvious but artwork remains dominant.

## 8. Dense garden

12 works, several relationships, mature growth.
Check:

- visual event cap
- no unreadable card pile
- no excessive particle DOM
- audio gain budget unchanged
- 30–60 seconds continuous drag/listen

## 9. Reduced motion

Force reduced motion.
Confirm no looping movement, but attack/role/relationship state remains legible through color/outline.

## 10. Regression

Run existing tests/scripts for DRAW v0.3, Garden, ENSEMBLE, GROW, PLAYGROUND, language, WONDER plus new ALIVE verification.

---

# R. Product test

After implementation, hand the phone to someone with no instructions.

Watch only.

Success signals:

- they tap a placed drawing because it looks touchable
- they move drawings together to see what happens
- they follow a call/response or cascade visually
- they poke the same drawing more than once
- they move the listener around for fun, not because told
- they return to DRAW and make something specifically to add to the Garden

The strongest possible sign is a spontaneous sentence like:

> **「これ動いてる。じゃあ、こっちは？」**

That is ALIVE.
