---
name: shader-lab
description: Tune, version, and compare the surface shaders that mark active work in the Shader Lab extension.
---

# Shader Lab

Shader Lab previews surface shaders on the chat's workspace container and on a ticket card with an active session, in light and dark themes side by side.

- Each shader can have several named versions. A version is one file: `design/shaders/<shader>/<version>.json`, holding `name` and `values`. A shader is in the lab while it has at least one version; deleting its last version removes it, and `shaders add` brings it back with default values.
- Shader ids, fields, ranges, steps, and defaults are defined in `extensions/pstdio-shader-lab/src/shaders/definitions.ts`. Missing values use the default. Values snap to each field's step and stay within its range.
- Pattern renderers are in `src/shaders/patterns.tsx`. Every shader shares opacity and the rasterized noise mask in `src/shaders/noise-mask.tsx`.
- Noise is rasterized when its settings or surface size change. Translations use compositor `transform` animations with cached pixels. Script motion, such as dash offset, uses the shared clock capped at 30 fps: a timer waits before requesting one frame. New shaders must state which kind of motion they use. Do not put frame time in React state or animate a live turbulence filter. Pause and hidden previews stop both kinds of motion. Timing changes preserve the current phase.
- Noise and its counter use matching whole CSS-pixel steps. Hatch steps along its rotated axis; ruler ticks step along x. This keeps slow drifts from producing a new image on every display refresh. Band sweeps use linear motion. Crosshair axes use independent `ease-in-out` alternate motion. Compositor previews update the elapsed-seconds label once per second; the script clock runs faster only while a script-motion listener is present.
- Counter motion uses the independent CSS `translate` property. Hatch and ruler movement use `transform` on that same content layer. Keep these motions on independent properties so they can compose without an extra layer or a per-frame style update.
- Compare two versions of one shader with "Compare with" in the Shader panel. That choice is review state, not design data.

Work with versions from the CLI. Open previews refresh after each change.

```sh
pst pstdio-shader-lab shaders list
pst pstdio-shader-lab shaders add --shader dots-to-grid
pst pstdio-shader-lab version read --shader section-hatch --version default
pst pstdio-shader-lab version update --shader section-hatch --version default --values '{"noiseScale": 320}'
pst pstdio-shader-lab version duplicate --shader section-hatch --version default --name "Larger patches"
pst pstdio-shader-lab version rename --shader section-hatch --version larger-patches --name "Big patches"
pst pstdio-shader-lab version delete --shader section-hatch --version larger-patches
```

Keep lines neutral and faint. Do not add colored glows or animated text; see `design/DESIGN.md`.
