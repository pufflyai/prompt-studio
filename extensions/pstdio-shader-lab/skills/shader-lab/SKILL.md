---
name: shader-lab
description: Tune, version, and compare the surface shaders that mark active work in the Shader Lab extension.
---

# Shader Lab

Shader Lab previews surface shaders on the chat's workspace container and on a ticket card with an active session, in light and dark themes side by side.

- Each shader can have several named versions. A version is one file: `design/shaders/<shader>/<version>.json`, holding `name` and `values`. A shader is in the lab while it has at least one version; deleting its last version removes it, and `shaders add` brings it back with default values.
- Shader ids, fields, ranges, and defaults are defined in `.pstdio/extensions/shader-lab/src/shaders/definitions.ts`. Missing or out-of-range values fall back to each field's default and range.
- Pattern renderers are in `src/shaders/patterns.tsx`. Every shader shares the opacity and noise mask in `src/shaders/noise-mask.tsx`.
- Noise is rasterized when its settings or surface size change. Playback moves cached pixels and updates only moving SVG attributes; do not put frame time in React state or animate a live turbulence filter. Hidden previews pause their clock.
- Compare two versions of one shader with "Compare with" in the Shader panel. That choice is review state, not design data.

Work with versions from the CLI. Open previews refresh after each change.

```sh
pst shader-lab shaders list
pst shader-lab shaders add --shader dots-to-grid
pst shader-lab version read --shader section-hatch --version default
pst shader-lab version update --shader section-hatch --version default --values '{"noiseScale": 320}'
pst shader-lab version duplicate --shader section-hatch --version default --name "Larger patches"
pst shader-lab version rename --shader section-hatch --version larger-patches --name "Big patches"
pst shader-lab version delete --shader section-hatch --version larger-patches
```

Keep lines neutral and faint. Do not add colored glows or animated text; see `design/DESIGN.md`.
