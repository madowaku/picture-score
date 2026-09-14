# v0.9 Creator Palette proof

Issue: #18

## What this proves

The same normalized Musical IR and the same deterministic WorldEvent mapping can be rendered through two visual vocabularies without changing analysis or mapping code.

- Palette A: **Clearing** — watercolor sprout / flower / seeds / star / grass
- Palette B: **Prism** — geometric ribbon / orbit / beat bars / light shard / wave

Both palettes receive the same five semantic roles:

| Musical meaning | Neutral role | Clearing | Prism proof |
| --- | --- | --- | --- |
| melodic line | melody | sprout | floating ribbon |
| harmonic change | harmony | flower | orbit ring |
| beat / pulse | rhythm | seeds | beat bars |
| ornament | ornament | star | light shard |
| resonance / long tail | resonance | grass | wave field |

Prism is intentionally internal. It is not a public Creator feature or a second official art pack.

## Minimum illustrator input model

An illustrator does **not** need to provide a rig, PSD structure, semantic labels inside the image, or animation code. The minimum useful contract is:

1. **Five ordinary transparent image assets**
   - one or more PNG, WebP, or SVG files for each neutral role: `melody`, `harmony`, `rhythm`, `ornament`, `resonance`
2. **Role assignment**
   - which image belongs to which of the five roles
3. **Optional image geometry**
   - anchor point and base scale
4. **Placement preset per role**
   - zone, clustering, minimum distance, scale range, rotation range
5. **Motion preset per role**
   - idle motion, birth motion, amplitude, speed, response strength, reduced-motion fallback
6. **World-level defaults**
   - initial environment response and section response
7. **Safety budget**
   - per-role and total entity limits

Everything above is already representable by `PaletteDefinition v1`.

## Explicit non-requirements for the proof

- no Creator UI
- no PSD / Live2D / Spine import
- no image understanding or semantic image recognition
- no per-asset custom JavaScript
- no change to Musical IR
- no change to WorldEvent mapping
- no change to source Stroke / Score / Music IR exports

## Determinism contract

For a fixed timeline, track seed, reduced-motion flag, and palette:

`snapshot(palette, seed, targetTime)` must deep-equal a fresh replay with the same inputs.

Changing only the palette is allowed to change:

- asset ids and sources
- scale and rotation
- placement zone interpretation
- motion profile
- environment response

It must not change the originating MusicalEvent / WorldEvent lineage.

## Performance comparison

The two sessions process the same WorldEvent cursor. Palette-specific work is bounded by the same entity limits. Browser QA measures repeated deterministic seeks for both palettes and reports the elapsed time as a regression signal; it also checks that neither palette creates overflow or unbounded entity counts.

## Product implication

If this proof holds, the future Creator workflow can stay small:

**images + role assignment + placement/motion presets → a new musical world**

That is the important boundary. Creator Palette authoring is a visual-language configuration problem, not a second music-analysis pipeline.
