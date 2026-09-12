# Picture Score Garden v0.1

Implements the first slice in GitHub issue #1: Draw → Hear → Place → Walk/listen → Draw again.

## Use

Draw or choose an example, then press PLACE IN GARDEN. Tap the landscape to place the preview; the work joins on the next shared beat. Drag pictures to reposition them. Tap empty ground or drag the ear to move the listening position. Focus an artwork or the ear and use arrow keys for keyboard movement. “ここに置く” places the preview without a pointer. DRAW returns to the current canvas; its existing new-canvas/Undo controls remain available to create the next work.

Up to 12 artworks live in the garden. Select an artwork to remove it. The garden and the drawing are saved independently in the browser. There are no accounts or network uploads. Storage failure is shown explicitly; a corrupt stored garden is not silently overwritten on load.

## Data and music

- `gardenState.ts`: serializable GardenState version 1 and MusicalObject snapshots, with Project, Stroke IR, Score IR, Music IR and world position. Loading validates project source and regenerates derived IR. The original project version 1 remains compatible.
- `gardenMixer.ts`: 2D smoothstep distance attenuation; at most two melody leaders, one harmony, one drone and two decoration/rhythm layers combined. Equal-distance neighbours rotate priority every 16 beats. The sum of target gains never exceeds 0.75.
- `gardenTransport.ts`: one AudioContext and 25ms lookahead scheduler for all objects. A shared C major-pentatonic context and BPM; original safe pitches stay intact. Entry aligns to the next beat, events to quarter-beat subdivisions, and phrases loop every 16 beats. Leading blank space is trimmed for immediate response; melodic intervals and relative timing remain recognizable. Moving updates persistent per-object gains with 120ms exponential targets without restarting transport. No accompaniment is duplicated per object; sustained/chord artworks supply those roles. A compressor and per-object voice limits bound dense input.
- `GardenView.tsx`: small paper-like landscape, direct pointer/touch placement, ear listener, keyboard controls and automatic saving. Leaving Garden or hiding the tab stops its audio, including a pending start.

The key and scale are fixed to the same C pentatonic context as DRAW in this slice. No semantic image recognition, AI arrangement, 3D world, progression systems or SylphNote integration are included.

## Verification

Run `npm test` and `npm run build`. Garden unit tests cover deep snapshots, regenerated IR, corruption rejection, role inference, smooth attenuation, three regions and all role caps in a 12-object cluster.

With the development server running, use a dedicated QA browser:

    npx @playwright/cli -s=garden open http://127.0.0.1:5174/
    npx @playwright/cli -s=garden run-code --filename scripts/verify-garden.cjs

The script resets only the Garden storage in that QA browser. It verifies desktop placement, navigation, saved IR, reload persistence, real AudioContext clock/stop/ramp behavior, offline cluster rendering and 390×844 CDP touch placement/listener/artwork movement. Captures go to output/playwright. Existing verify-v02.cjs and verify-v03.cjs cover DRAW regressions. Browser emulation does not replace listening and gesture checks on physical phones, particularly Safari.
