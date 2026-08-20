# Prompt Studio Font Editor

Repository-local Fontello-style editor for the icon font in `packages/ui/public/font`.

Open **Tools → Font editor** in Prompt Studio to search and preview glyphs, import SVG artwork, rename or remove glyphs, move codepoints, configure outputs, and rebuild the font. The same operations are available through `pst font-editor`.

The extension keeps the configured TTF as its canonical source. It normalizes the three contour aliases in the supplied font from the existing CSS so all 220 semantic glyph mappings remain independently editable. Mutations generate EOT, SVG, TTF, WOFF, WOFF2, and CSS in memory and verify their mappings before writing any file.

## CLI commands

```sh
pst font-editor inspect
pst font-editor preview
pst font-editor glyph add --name <name> (--svg <markup> | --svg-path <path> | --file-id <id>) [--codepoint <value>]
pst font-editor glyph rename --glyph <name-or-codepoint> --name <name>
pst font-editor glyph codepoint --glyph <name-or-codepoint> --codepoint <value>
pst font-editor glyph remove --glyph <name-or-codepoint>
pst font-editor config get
pst font-editor config set [options]
pst font-editor build
pst font-editor verify
```

`config set` accepts `--family`, `--file-name`, `--css-prefix`, `--fonts-url`, `--output-dir`, `--css-file`, `--start-codepoint`, and `--end-codepoint`.

Run `pst font-editor <command> --help` for current options.

## Development

```sh
bun install
bun test
bun run typecheck
```
