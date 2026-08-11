---
name: font-editor
description: Inspect and safely extend the repository's icon font, including adding SVG glyphs, renaming glyphs, moving codepoints, removing glyphs, rebuilding formats, and verifying CSS mappings.
---

# Font Editor

Use the repository-local `font-editor` extension through `pst`. Run commands from the repository whose font should change.

## Safety contract

- Treat the configured TTF as the canonical editable source.
- Inspect before editing and identify a glyph by its current name or `U+XXXX` codepoint.
- Add only single-color SVG path artwork. Vector path editing is outside this tool.
- Let the tool select the next unused private-use codepoint unless the task requires a specific value.
- Never edit generated EOT, SVG font, TTF, WOFF, WOFF2, or CSS files by hand.
- Every mutation generates all outputs in memory, verifies their semantic maps, and only then commits them.
- Run `verify` after the final edit and report the returned glyph count and formats.

## Inspect

```sh
pst font-editor inspect --json
pst font-editor config get --json
```

The inspection output contains `family`, font metrics, and a `glyphs` array with `name`, `codepoint`, `unicode`, and `advanceWidth`.

## Add an SVG

```sh
pst font-editor glyph add --name agent-spark --svg-path path/to/agent-spark.svg --json
```

To request a codepoint:

```sh
pst font-editor glyph add --name agent-spark --svg-path path/to/agent-spark.svg --codepoint U+F100 --json
```

API callers and agents that already have SVG markup may pass it directly:

```sh
pst font-editor glyph add --name agent-spark --svg '<svg viewBox="0 0 24 24">...</svg>' --json
```

## Rename, move, or remove

```sh
pst font-editor glyph rename --glyph data-intiger --name data-integer --json
pst font-editor glyph codepoint --glyph data-integer --codepoint U+F100 --json
pst font-editor glyph remove --glyph obsolete-glyph --json
```

Renaming and moving codepoints preserve contours. Removing a glyph is destructive, so inspect first and verify the identifier.

## Configure outputs

Pass only settings that should change:

```sh
pst font-editor config set \
  --family product-icons \
  --file-name product-icons \
  --css-prefix icon- \
  --fonts-url '$fonts' \
  --output-dir packages/ui/public/font \
  --css-file css/product-icons.css \
  --start-codepoint U+E800 \
  --end-codepoint U+F8FF \
  --json
```

Changing configuration rebuilds the outputs and moves the canonical TTF to the configured output directory and file name.

## Build and verify

```sh
pst font-editor build --json
pst font-editor verify --json
```

`build` regenerates EOT, SVG, TTF, WOFF, WOFF2, and CSS. `verify` checks every font and every CSS selector against the canonical TTF without writing.
