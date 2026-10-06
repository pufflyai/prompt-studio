---
name: shape-art
description: Paint reusable watercolor art from the Prompt Studio tool shapes and save it under design/art.
---

# Shape Art pieces

A piece is a recipe in `design/art/<id>.json` and its painted image in `design/art/<id>.png`. The same recipe always paints the same image, so commit both and edit the recipe to change the art.

1. Run `pst shape-art piece list` to see existing pieces. Read one with `pst shape-art piece read --id <id>`.
2. Generate a random piece with `pst shape-art piece generate --id <kebab-id> --background ink --width 1600 --height 400`. This makes a 4:1 banner and saves its full recipe and PNG. Use a different id for each blog post. Or supply a recipe with `pst shape-art piece save --id <kebab-id> --recipe '<json>'`; omitted fields use the defaults below.
3. After editing a recipe file by hand, run `pst shape-art piece render --id <id>` to repaint the PNG.
4. Open the PNG to check the result. Try a few seeds before settling: the seed decides placement, colors, and texture.
5. Delete a piece with `pst shape-art piece delete --id <id>`.

Run `pst shape-art piece generate --help` for its flags. Background choices are `paper` (default) and `ink`. Width and height default to 1600×900; both accept whole pixels from 64 to 4096. Other settings are random. The result includes the saved seed and file paths; `--json` gives a machine-readable execution response.

Pass `--seed <text>` to repeat the same generated recipe with the same dimensions and background. Omit it for a new random composition. `piece generate` replaces an existing id; `piece render` preserves and repaints that id's current recipe.

Blog banners use ink backgrounds with blue and pink glows. Avoid yellow and orange shapes: after generation, save the recipe with `kinds` set to `["page", "editor", "skill", "hook"]` and `gradient` at most `0.3` to keep the color drift cool. Preserve its other settings and seed so every post keeps a different composition.

## Recipe fields

| Field | Default | Meaning |
| --- | --- | --- |
| `seed` | `prompt-studio` | Any text. Changes the whole composition |
| `width`, `height` | `1600`, `900` | Output size in pixels (64 to 4096) |
| `layout` | `scatter` | `scatter` spreads shapes, `shelf` rests them on the bottom edge, `solo` paints one large shape |
| `kinds` | all six | Any of `page`, `command`, `editor`, `skill`, `hook`, `automation` |
| `count` | `9` | Number of shapes (1 to 40). `solo` ignores it |
| `scale` | `1` | 0.2 to 3. Multiplies every shape's size. A smaller shelf fits more shapes |
| `offsetX`, `offsetY` | `0`, `0` | -1 to 1. Moves the whole composition by a fraction of the canvas width and height. Negative `offsetY` lifts the shelf |
| `backgroundTop`, `backgroundBottom` | `#F7F2E8`, `#EAE1D1` | `#RRGGBB` colors of the vertical background gradient. Light backgrounds glaze pigment like watercolor; dark ones (for example `#0A0C10` to `#141A28`) take opaque paint |
| `bleed` | `0.4` | 0 to 1. How far pigment wanders past the outline |
| `layers` | `36` | 4 to 80. More layers give softer edges |
| `texture` | `0.6` | 0 to 1. Blotchy pigment and paper granulation |
| `gradient` | `0.5` | 0 to 1. Color drift inside shapes and background glow |
| `grain` | `0.4` | 0 to 1. Film grain over the image |

Shape colors come from the landing page illustration tokens, so a shape's color always matches its meaning.

Use the PNG as a source image. The landing page optimizes images imported through Astro assets.
