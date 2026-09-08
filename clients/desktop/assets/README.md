# Desktop app icon

`icon.svg` is the source for the desktop app icon. It keeps the existing Prompt
Studio mark centered on a white circle. The mark fills 65% of the circle's
diameter, leaving padding around it. The area outside the circle is transparent.

To regenerate every platform asset from the repository root:

```bash
bun run --cwd clients/desktop icons:generate
```

The script uses the desktop package's Playwright Chromium installation. If the
browser is missing, run `bunx playwright install chromium` from `clients/desktop`.
Commit the SVG and generated files together.

Electron Forge uses `icon.icns` for macOS, `icon.ico` for Windows, and `icon.png`
for Linux. The `icons` directory contains the smaller PNG sizes. Windows includes
16, 32, 48, and 256 pixel images; macOS includes sizes from 16 to 1024 pixels.
