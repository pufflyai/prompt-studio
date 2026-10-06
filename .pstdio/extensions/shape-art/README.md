# Shape Art

Repository-local tool that paints grainy watercolor art from the six Prompt Studio tool shapes: page, command, editor, skill, hook, and automation.

Open **Shape Art** in the project navigation. Change the composition, background colors and paint settings on the right; the preview repaints as you go. **Save** writes the recipe to `design/art/<id>.json` and a full-size PNG to `design/art/<id>.png`. Pieces are read from and written to the default project folder.

The same commands work from the CLI, so agents can make art too:

```sh
pst shape-art piece list
pst shape-art piece generate --help
pst shape-art piece generate --id blog-banner --background ink --width 1600 --height 400
pst shape-art piece read --id <id>
pst shape-art piece save --id <id> --recipe '{"layout":"shelf","backgroundTop":"#0A0C10","backgroundBottom":"#141A28"}'
pst shape-art piece render --id <id>
pst shape-art piece delete --id <id>
```

The bundled skill documents every recipe field.

`piece generate` randomizes the layout, shape selection, count, placement, and paint settings. It saves both the complete recipe and PNG. `--background` accepts `paper` (default) or `ink`; dimensions default to 1600×900 and must be whole pixels from 64 to 4096. For a 4:1 banner, use `--width 1600 --height 400`.

Paper and ink backgrounds use blue and pink glows. For blog banners, avoid yellow and orange shapes too: save the generated recipe with `kinds` set to `page`, `editor`, `skill`, and `hook`, and `gradient` at most `0.3` to keep the color drift cool. Keep each post's own seed and composition.

Each call gets a new random seed. Pass `--seed <text>` to reproduce the same generated recipe with the same dimensions and background. To repaint an edited recipe, use `piece render` instead. An existing piece id is replaced, just as with `piece save`.

## How it paints

The renderer is plain TypeScript with no canvas dependency, so the browser preview and the saved PNG come from the same code.

- `src/art/layout.ts` places shapes for each layout.
- `src/art/watercolor.ts` wobbles each outline and gives every translucent layer a slightly different edge.
- `src/art/render.ts` stacks those layers into a pigment mask, darkens the rim where pigment pools, and applies granulation and a color gradient.
- `src/art/surface.ts` holds the sheet, a gradient between two background colors. On a light sheet, pigment adds up as optical density, so overlapping shapes glaze like real watercolor. It also adds the background glow and grain.
- A seeded random generator makes every recipe reproducible.

## Development

```sh
bun test src
bun run typecheck
```

For a blog post, keep the same composition and seed in both variants. Save the light recipe as `<id>-light` with paper colors (`#F7F2E8` to `#EAE1D1`) and the dark recipe as `<id>` with ink colors (`#0A0C10` to `#141A28`). Both remain opaque. The landing page chooses the image for its active theme; only the newest post shows artwork in the blog list.
