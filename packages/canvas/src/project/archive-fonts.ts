import { createHash } from "node:crypto";
import type { FrameManifest } from "./manifest";

// Bun can emit a font file or inline a small one. By this point both are data URLs.
// Keep each face declaration in place, including its format, range and fallback order.
export const createFontArchive = (
  modules: FrameManifest["modules"],
  write: (path: string, data: string) => Promise<void>,
) => {
  const fonts = new Map<string, string>();
  return async (css: string) => {
    const imports = new Set<string>();
    const added = new Map<string, string>();
    const code = css.replace(
      /url\((["']?)data:(?:font\/(woff2?|ttf|otf)|application\/(vnd\.ms-fontobject));base64,([A-Za-z0-9+/=]+)\1\)/gi,
      (_, _quote, fontType, eot, data: string) => {
        const extension = eot ? "eot" : fontType.toLowerCase();
        const key = `${extension}:${data}`;
        let name = fonts.get(key);
        if (!name) {
          const bytes = Buffer.from(data, "base64");
          name = `${createHash("sha256").update(bytes).digest("hex")}.${extension}`;
          fonts.set(key, name);
          added.set(name, data);
        }
        imports.add(name);
        return `url("canvas-font:${name}")`;
      },
    );
    // Read newly introduced fonts together through the project mount on a first visit.
    if (added.size) {
      const packed = JSON.stringify(Object.fromEntries(added));
      const file = `modules/${createHash("sha256").update(packed).digest("hex")}.fonts.json`;
      await write(file, packed);
      for (const [name, data] of added) {
        modules[name] = { file, bytes: Buffer.byteLength(data, "base64"), imports: [], dynamicImports: [] };
      }
    }
    return { code, imports: [...imports] };
  };
};
