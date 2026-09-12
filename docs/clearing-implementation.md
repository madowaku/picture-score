# Garden v0.6.1 — CLEARING

Issue: [#7](https://github.com/madowaku/picture-score/issues/7). Specification: [picture-score-v061-clearing.md](picture-score-v061-clearing.md).

Growth frames the drawing, never covers it. 作品はそのままに、育つ足元を外側へ。

## Implementation

- `clearing.ts` derives a stable ellipse from source ink, canvas aspect and responsive layout constants. Stage 3 adds 10 normalized units of breathing room. Production code never measures DOM geometry for growth.
- Source artwork bounds are shared with `GardenArtwork`; only the growth/light layers are masked. The same exclusion mask includes every neighbour, so crossing relation paths also avoid third-party artwork.
- Five generated transparent watercolor sprites replace the centre-origin strokes. Stages 1/2/3 request 3/6/8 stable perimeter marks. Increasing maturity moves existing marks outward. Conflicting, off-field and crowded marks are omitted; the cap remains 8 per work.
- Relation curves begin/end just outside ellipse edges. Gaps below 14 normalized units are omitted and short gaps fade. At most 24 persistent relation paths are considered.
- ALIVE briefly brightens the stationary habitat; no growth scale animation crosses the drawing. Transient relation light uses the same edge geometry and exclusion mask.
- GROW counters/thresholds, Growth v1/Garden v1 persistence, source Stroke/Score/Music IR, transport and export logic are unchanged by CLEARING. This builds on the preceding ALIVE implementation.

Responsive geometry mirrors `styles.css`, `garden.css` and `alive.css`; update `gardenLayout` alongside future field/artwork sizing changes. Resize events recompute the layout; there are no per-frame DOM reads.

## Generated assets

Generated with the built-in image generation tool, one request per asset. No API/CLI fallback. The model returned RGBA PNGs with transparent backgrounds. FFmpeg resized each to a 256×256 lossless WebP, preserving alpha; no substitute hand-drawn sprites were used.

| Asset | Shipped path | Bytes |
| --- | --- | ---: |
| Tender sprout | `public/art/clearing-sprout.webp` | 9,692 |
| Grass tuft | `public/art/clearing-grass.webp` | 14,520 |
| Seed pigment dots | `public/art/clearing-seeds.webp` | 5,794 |
| Watercolor star | `public/art/clearing-star.webp` | 9,454 |
| Five-petal flower | `public/art/clearing-flower.webp` | 17,380 |

Originals remain under `C:/Users/hiro/.codex/generated_images/01a09598-2c15-7762-9cfc-5253f896af00/`. Workspace copies are in ignored `output/imagegen/clearing-{sprout,grass,seeds}.png`.

Melody uses sprouts, harmony uses flowers, drone uses grass, rhythm uses seed dots, and decoration uses stars with lower opacity. The assets are always placed outside the shared clearing mask.

### Prompt set

**sprout**

Use case: stylized-concept. Asset type: isolated transparent 2D watercolor ground sprite for Picture Score's musical garden. Primary request: ONE tiny tender sprout, two plump asymmetrical sage and mint green leaves on a very short curved stem, leaning gently upward. Soft filled watercolor shapes, subtle pigment grain, no dark outlines; handcrafted Japanese picture-book feel, airy, friendly and quiet. Warm olive base, cool pale mint leaf tips. Entire plant fits within the central 65 percent of a square canvas, base at the lower center, plenty of transparent padding on all sides. It must be recognizable when displayed at 24 CSS pixels. True transparent background with alpha, no white rectangle, no checkerboard drawn into the image, no ground, no shadow, no scenery, no pot, no flower, no text, no symbols, no characters, no watermark. Only this single small sprout. Production sprite.

**grass**

Use case: stylized-concept. Asset type: isolated transparent 2D watercolor ground sprite for Picture Score's musical garden. Primary request: ONE small low tuft of grass, five softly curved tapered blades growing from a compact common base. Calm rounded sweep, loosely fanning upward and outward, no spikes. Pale sage, seafoam mint and warm olive watercolor pigment; soft filled shapes and subtle grain, no dark outlines. Handcrafted Japanese picture-book style, quiet and airy. Entire tuft fits in the central 65 percent of a square canvas with generous transparent padding; base at lower center. Readable at 26 CSS pixels. True transparent background with alpha, no white rectangle, no checkerboard drawn into image. No soil, no cast shadow, no scenery, no flowers, no pot, no text, no characters, no symbols, no watermark. Only the single tuft. Production sprite.

**seeds**

Use case: stylized-concept. Asset type: isolated transparent 2D watercolor ground sprite for Picture Score's musical garden. Primary request: ONE tiny irregular grouping of exactly THREE rounded seed-like watercolor dots, softly filled golden ochre, muted leaf green and warm pale amber. Each dot is an organic oval dab of pigment, with subtle watery edges and grain, no outlines. Their spacing feels natural like a few seeds on paper; cluster kept compact, no connecting stems. Handcrafted Japanese picture-book style, quiet, cheerful and delicate. Entire cluster in the center 55 percent of a square canvas, generous transparent padding, readable at 18 CSS pixels. True transparent background with alpha, no white rectangle and no painted checkerboard. No paper background, ground wash, shadow, plants, flowers, stars, text, symbols, characters or watermark. Only the three small pigment dots. Production sprite.

**star**

Use case: stylized-concept. Asset type: isolated transparent 2D watercolor ground sprite for Picture Score's musical garden. ONE tiny five-pointed star-shaped wildflower spark, softly filled golden ochre with a muted sage-green center and pale amber wash. Handcrafted Japanese picture-book watercolor, delicate pigment grain, organic painted edges, no dark outline. Centered in the middle 55 percent of a square canvas with generous transparent padding. Readable at 18 CSS pixels. True transparent background with alpha; no white rectangle, no checkerboard, no ground, no shadow, no scenery, no stem, no leaves, no other objects, no text, no characters, no watermark. Only this one small watercolor star sprite.

**flower**

Use case: stylized-concept. Asset type: isolated transparent 2D watercolor ground sprite for Picture Score's musical garden. ONE tiny cheerful five-petal meadow flower, softly filled blush coral, butter yellow and pale lilac watercolor petals around a warm ochre center, with a very short muted sage stem and two tiny rounded leaves. Handcrafted Japanese picture-book watercolor, delicate pigment grain, organic painted edges, no dark outline. Centered in the middle 60 percent of a square canvas with generous transparent padding. Readable at 22 CSS pixels. True transparent background with alpha; no white rectangle, no checkerboard, no ground, no shadow, no scenery, no pot, no extra flowers, no other plants, no text, no characters, no watermark. Only this one small watercolor flower sprite.

## Verification

- `npm test`: 76 tests passed across 12 files, including new geometry and generated-role checks plus existing growth, transport, WONDER, IR and export tests.
- `npm run build`: TypeScript and production build passed.
- `scripts/verify-clearing.cjs`: Chromium at 1440×900 and 390×844; same cat/wave/star/tall drawing at stages 0/1/3; pixel-rasterized growth has zero painted pixels inside the protected interior. The actual SVG ink also fits each clearing. Four mature works show 31 desktop / 28 mobile marks; 12 mature works show 36 mobile marks and 22 paths. The close pair has 7 marks and no path. Reload is deterministic and moving a mature drawing updates its clearing.
- Screenshots: `output/playwright/clearing-{1440,390}-stage-{0,4,64}.jpg`, `clearing-dense-{mobile,desktop}.jpg`, `clearing-close-mobile.jpg`.
- No page exceptions or failed art requests in the CLEARING browser check.

Run browser checks in an isolated CLI session after opening the local development URL:

```sh
npx @playwright/cli -s=clearing open http://127.0.0.1:5173
npx @playwright/cli -s=clearing run-code --filename scripts/verify-clearing.cjs --raw
```

Physical iOS/Android touch feel and device audio have not been checked; mobile results above are browser emulation.
