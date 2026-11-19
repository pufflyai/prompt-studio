import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Skip quoted strings and comments so an authored CSS content string stays literal.
const cssFontUrls =
  /\/\*[\s\S]*?\*\/|url\(\s*(["']?)data:font\/(woff2|woff|ttf|otf);base64,([\w+/=]+)\1\s*\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gi;

export const emitWebviewFonts = (distDir: string) => {
  const fonts = new Map<string, string>();
  for (const file of readdirSync(distDir)) {
    if (!file.endsWith(".css")) continue;
    const path = join(distDir, file);
    const css = readFileSync(path, "utf8");
    const updated = css.replace(cssFontUrls, (url, _quote, extension: string | undefined, base64: string) => {
      if (!extension) return url;
      let filename = fonts.get(url);
      if (!filename) {
        const bytes = Buffer.from(base64, "base64");
        const hash = createHash("sha256").update(bytes).digest("hex");
        filename = `font-${hash}.${extension.toLowerCase()}`;
        writeFileSync(join(distDir, filename), bytes);
        fonts.set(url, filename);
      }
      return `url(./${filename})`;
    });
    if (updated !== css) writeFileSync(path, updated);
  }
};
