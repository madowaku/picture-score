# Picture Score v0.9 — Core Meaning QA

Issue: #17

Goal: verify that the five semantic roles are readable as musical meaning rather than decorative motion.

## Automated fixtures

The QA harness uses five fixed Musical IR fixtures:

- Scene A — quiet piano
- Scene B — steady beat
- Scene C — dense electronic
- Scene D — ambient long-tail
- Scene E — ornament-heavy

Run the development server and open:

`http://127.0.0.1:5173/core-meaning-qa.html`

The page intentionally starts blind. Scene buttons show only A–E. Do not press **Reveal answer** until the reviewer has committed to an interpretation.

## Human acceptance test

Use a reviewer who has not been shown Picture Score's semantic legend immediately before the test.

1. Show Scenes A–E for roughly 6–10 seconds each. Replay is allowed once.
2. Do not explain what sprouts, flowers, seeds, stars or grass mean.
3. Ask the reviewer to identify which visual behavior represents:
   - melody activity
   - harmony/chord change
   - beat/rhythm
   - brief ornament/detail
   - sustained resonance/space
4. Record the reviewer's mapping before revealing the intended answer.
5. Press **Reveal answer** only after the mapping is recorded.
6. Repeat one representative scene with **Reduced motion** enabled and ask whether the same meaning is still understandable.

Pass criterion from #17: **at least four of the five role mappings are identified correctly after the short demo without a legend.**

Automation cannot satisfy this human-perception criterion. CI only checks structural/perceptual proxies and produces blind screenshots for review.

## Review record

| Role | Reviewer answer | Correct? | Notes |
| --- | --- | --- | --- |
| Melody |  |  |  |
| Harmony |  |  |  |
| Rhythm |  |  |  |
| Ornament |  |  |  |
| Resonance |  |  |  |

Score: `__/5`

Reviewer: `__________`

Date: `__________`

Reduced-motion understandable: `yes / no`

## Automated browser gate

`scripts/verify-core-meaning.cjs` checks all required sizes:

- 360×800
- 390×844
- 720×1280
- 1440×900

It verifies these proxies:

- quiet piano remains sparse and does not leak unrelated roles
- harmony appears at a discrete change moment
- melody birth receives its growth reaction
- steady rhythm arrives as local seed pops while rhythm entities have no persistent idle bounce
- dense electronic keeps several semantic roles visible while remaining bounded
- ambient long-tail visibly establishes resonance grass with sway
- ornament-heavy material is ornament-led and twinkles in the upper field
- reduced motion preserves entities/roles while continuous idle motion resolves to `none`
- DRAW/GARDEN navigation still works
- no horizontal overflow, page errors or failed `/art/` assets

Screenshots are uploaded from CI under the browser QA artifact for manual inspection.

## Intended Clearing vocabulary

This section is the answer key. Keep it hidden from a blind reviewer until after scoring.

- melody → sprout / birth + growth
- harmony → flower / bloom moment
- rhythm → seeds / local pop pulse
- ornament → star / brief twinkle
- resonance → grass / sustained sway

The objective is not to make every viewer name the exact asset. The reviewer should connect the *behavior* to the correct musical function.
