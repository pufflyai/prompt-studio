import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

export const MAX_EXTENSION_ICON_BYTES = 256 * 1024;

interface CatalogIconOwner {
  installName: string;
  extensionId?: string;
  icon?: string;
  origin: { url: string; path: string; ref: string };
}

/** The public asset belongs to one exact catalog package and declared path. */
export const extensionIconAssetName = (entry: CatalogIconOwner) => {
  const key = JSON.stringify([
    entry.installName,
    entry.extensionId,
    entry.origin.url,
    entry.origin.path,
    entry.origin.ref,
    entry.icon,
  ]);
  return `${createHash("sha256").update(key).digest("hex")}.svg`;
};

/** Keep Lucide names unchanged. SVG paths always belong to the extension package. */
export const readExtensionIcon = (root: string, icon: string | undefined) => {
  if (!icon) return undefined;
  if (!icon.startsWith("./")) return icon;
  if (!icon.endsWith(".svg") || icon.includes("\\")) {
    throw new Error("Extension icon assets must use a relative ./path.svg");
  }
  const source = realpathSync(root);
  const path = realpathSync(resolve(source, icon));
  const rel = relative(source, path);
  const stat = statSync(path);
  if (rel.startsWith("..") || isAbsolute(rel) || !stat.isFile()) {
    throw new Error("Extension icon must be a file inside its package");
  }
  if (stat.size > MAX_EXTENSION_ICON_BYTES) throw new Error("Extension SVG icon exceeds 256 KiB");
  const bytes = readFileSync(path);
  return `data:image/svg+xml;base64,${bytes.toString("base64")}`;
};
