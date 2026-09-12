# Picture Score v0.4 — PLAYGROUND

> **Everything invites a touch.**

Picture Score must stop looking like a quiet AI creative-tool demo and start feeling like a musical toy you want to touch again immediately.

This phase is not primarily about adding more product features. It is a **playability + identity pass** across DRAW and GARDEN.

The desired reaction is not “this is elegant.” It is:

> “What happens if I touch this?”
> “What happens if I move these together?”
> “I want to draw one more thing.”

---

## Product identity

Picture Score is a standalone app.

It is not designed as a front-end for another world/project, and no future-product integration should influence UI or product decisions in this phase.

The product is:

**draw → hear → place → move → combine → grow → draw again**

A musical sandbox / drawing instrument / living toy.

---

# 1. Visual direction: leave the “AI beige” behind

Current visual issues to actively remove:

- large editorial serif/italic hero treatment
- low-contrast beige/olive-only palette
- excessive empty-space-as-luxury styling
- generic AI creative SaaS tone
- controls that look elegant but not tempting to press

New direction:

**paper + toy + instrument + garden**

Not childish, not candy UI, not corporate. Warm, tactile, colorful, slightly odd.

### Type

Prefer a friendly rounded/grotesk system over fashion-editorial serif.

Recommended first experiment:

- UI / Japanese: `M PLUS Rounded 1c`
- English display / UI: `Nunito Sans` or `Fredoka`
- keep the Picture Score wordmark custom/hand-drawn if useful

Do not use a giant italic serif sentence as the primary product personality.

### Color system

Keep an off-white/paper base, but add real chroma.

Suggested semantic palette tokens (exact hues may be tuned visually):

- `--ps-coral`: primary action / PLAY
- `--ps-leaf`: growth / Garden
- `--ps-sky`: listening / spatial relation
- `--ps-butter`: discovery / answer / sparkle
- `--ps-plum`: unusual/ensemble accent
- `--ps-ink`: text/strokes
- `--ps-paper`: background

Use color as feedback, not decoration soup.

Each musical role may borrow one accent family, but artwork itself remains readable and is not recolored beyond recognition.

### Shape language

- controls: chunky enough to invite pressing
- radii: friendly but not glassmorphism-pill-everything
- avoid frosted glass
- use slightly irregular or hand-drawn micro-details where cheap
- shadows should feel like paper/toy depth, not floating SaaS cards

---

# 2. Touch response system

Every meaningful touch should answer within the same interaction.

Create a small reusable feedback system rather than ad-hoc animations.

## Press

Buttons and tappable artworks should visibly compress by a few percent on pointerdown and recover on release.

No sluggish 300–500ms UI easing. Primary touch response should begin effectively immediately.

## Place

When an artwork is planted in Garden:

1. it lands with a tiny scale squash
2. its first audible note triggers a small visual bloom
3. nearby growth/ground reacts once

Do not show confetti.

## Move

Dragging artwork must feel direct. While moving:

- relation strength changes continuously
- relationship visuals stretch/shrink like a soft elastic thread
- ensemble change remains on the shared musical clock
- no transport restart

## Hear

When an object actually emits a musical event, its visual form gets a very short pulse/breath proportional to role and velocity.

The pulse must communicate “that object made that sound.”

## Optional tactile feedback

Feature-detect `navigator.vibrate` and use only a very short, subtle tick for supported Android browsers on important land/snap events.

Never make vibration required; iOS/no-support must feel complete.

---

# 3. Garden interactions: make the world a toy

Current core remains: listener position + distance + shared clock + ENSEMBLE + GROW.

Add simple interactions that make users experiment without opening menus.

## Tap artwork → “ping me”

A quick tap on a placed artwork should audition a short, musically safe fragment/answer from that artwork.

- does not stop Garden transport
- quantized if Garden is playing
- immediate short response if Garden is stopped
- visually pulses the artwork

This makes every placed drawing touchable.

## Temporary spotlight

When a selected artwork is activated via a clear accessible control (tap-selected then Spotlight button, or another unambiguous single-tap pattern), let it become the musical lead for a short fixed window such as 4 beats.

- no permanent state
- no inventory/status mechanic
- surrounding parts gently duck, not mute
- after the window, normal ensemble rules resume

Purpose: user can “point at” a drawing and hear it step forward.

## Sweep / listener play

Moving the listener through the Garden should feel like playing a crossfader spatially.

Improve feedback:

- listener becomes a small animated listening orb/waveform rather than only a utility icon
- nearby audible objects gain a subtle ring/pulse
- the orb leaves a very short fading trace while being dragged

Do not turn it into a mascot with dialogue.

## Relationship moment

When two objects cross into a strong ensemble relation for the first time in a session:

- relationship thread becomes briefly more visible
- both objects answer once on the next musical boundary
- then visuals calm down

This should produce “they noticed each other.”

---

# 4. DRAW: make drawing itself more playful

Do not let all fun live in Garden.

## Stroke Answer stays central

Every stroke continues to answer musically.

Strengthen the feedback so the sequence reads clearly:

**draw → magnetic settle → short answer**

The visual settle may use role/accent color briefly, then return to the artwork palette.

## Gesture personality

Preserve No Useless Strokes and make it legible through feedback:

- dot → ping
- horizontal → sustain
- vertical → chord
- smooth curve → legato
- zigzag → articulated/staccato tendency
- dense repeated stroke → richer response

The UI should never explain all of this at once.

Instead, after playback or when canvas is empty, show one rotating playful hint such as:

- 「縦に描くと、ジャーン。」
- 「ぐるぐるは、どんな音？」
- 「名前を鳴らしてみる？」

Hints disappear immediately when drawing starts.

## PLAY button

PLAY is the hero control and should feel irresistible.

- stronger physical press
- play state visibly animates in time with master beat
- label/icon remains clear
- no huge decorative hero text competing with it

---

# 5. GROW should be noticeable, not apologetic

v0.3 GROW must not become nearly invisible “tasteful moss.”

Keep growth elegant, but make progress visible enough that a user notices the Garden changing within a normal session.

Guideline:

- first meaningful trace: within ~10–20 seconds of actual audible play
- clear local growth: within ~1 minute around an active object
- shared path/relationship trace: visible during a normal 3–5 minute experiment, not after hours

Growth should still be bounded and never bury the drawings.

Role families may have stronger distinct silhouettes:

- melody: curling shoots / small leaves
- harmony: clustered rounded growth
- drone: broad grass/rings
- rhythm: dotted sprouts / pebbles
- decoration: tiny star/seed marks

These are abstract visual responses to musical role, not semantic recognition of the drawing.

---

# 6. Identity through sound, not only visuals

The app should have a small “toy instrument” sound identity.

Keep the existing synth/instrument system, but add a short UI sound vocabulary where useful:

- magnet settle
- plant/place
- relation formed
- growth threshold
- remove/undo

Rules:

- short
- soft enough not to fight the music
- tonal where possible so UI sounds belong to the active key
- no generic casino/mobile-game jingles

Prefer synthesizing simple UI tones from the existing audio engine where possible instead of adding many audio files.

---

# 7. Motion implementation policy

Do not add a heavy animation stack by default.

First choice:

- CSS transitions / keyframes
- Web Animations API
- existing React state

If spring/gesture choreography becomes materially simpler with a dependency, `motion` is acceptable, but document why it is needed and keep the bundle impact visible.

Do not introduce Rive/Pixi/Paper.js just for decoration in this phase.

Respect `prefers-reduced-motion`:

- keep state/color/scale feedback
- remove looping/bouncy decorative motion

---

# 8. Mobile-first layout pass

Primary target remains phone touch.

Test at minimum:

- 360×800
- 390×844
- 720×1280 equivalent density
- desktop 1440×900

Goals:

- PLAY reachable and obvious
- DRAW / ERASE easy with thumb
- no tiny text-as-button controls
- Garden artworks remain draggable without accidentally moving listener
- no accidental page scrolling while manipulating Garden
- important feedback not hidden behind finger

Consider PWA standalone-display polish later, but do not let browser chrome block this phase.

---

# 9. Explicitly avoid

Do not add:

- XP / levels
- coins/currencies
- streaks
- daily missions
- rarity
- loot/collection mechanics
- AI chat panel
- generative “make me a song” prompt box
- glassmorphism
- generic purple/blue AI gradients
- giant serif inspirational marketing copy inside the instrument

Picture Score should feel fun because the **system itself is fun to touch**.

---

# 10. Acceptance tests

PLAYGROUND is successful when:

1. Empty DRAW screen makes an unbriefed person want to touch/draw within a few seconds.
2. A stroke gives immediate visual + musical response.
3. PLAY feels like the obvious next action.
4. In Garden, tapping a drawing gives a response.
5. Moving two drawings together visibly and audibly creates a relationship.
6. User can identify which object just made a sound from visual feedback alone.
7. Growth becomes visibly noticeable during a normal short session.
8. Visual identity no longer resembles a generic muted AI creative SaaS page.
9. 390×844 interaction remains comfortable.
10. Existing DRAW playback/export, Garden persistence, ENSEMBLE timing, and GROW state do not regress.

---

# 11. Product test

Give the phone to someone with no explanation.

Do not ask whether it is beautiful.

Observe only:

- do they draw?
- do they press PLAY?
- do they move things in Garden?
- do they tap placed drawings?
- do they make a second drawing without being asked?
- do they show someone else what they made?

The decisive moment is:

> **They finish one thing and immediately try another because they are curious what will happen.**

That is PLAYGROUND.
