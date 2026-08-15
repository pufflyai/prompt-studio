# Prompt Studio Font Editor

Repository-local Fontello-style editor for the icon font in `packages/ui/public/font`.

Open **Tools → Font editor** in Prompt Studio to search and preview glyphs, import SVG artwork, rename or remove glyphs, move codepoints, configure outputs, and rebuild the font. The same operations are available through `pst font-editor`.

Repository-specific font paths and output settings live in `.pstdio/configs/font-editor.json`. The extension reads and updates that file instead of defining repository settings in its implementation.

The extension keeps the configured TTF as its canonical source. It normalizes the three contour aliases in the supplied font from the existing CSS so all 220 semantic glyph mappings remain independently editable. Mutations generate EOT, SVG, TTF, WOFF, WOFF2, and CSS in memory and verify their mappings before writing any file.

## Development

```sh
bun install
bun test
bun run typecheck
```
