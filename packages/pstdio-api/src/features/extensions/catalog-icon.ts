import { resolve } from "node:path";
import { extensionIconAssetName, readExtensionIcon } from "pstdio-extensions";
import { type ExtensionCatalogEntry, packagedExtensionCatalog } from "./extension-catalog";

/** Catalog icons are public display metadata, never host filesystem paths. */
export const resolveCatalogIcon = async (entry: ExtensionCatalogEntry, files = Bun.embeddedFiles) => {
  if (!entry.icon?.startsWith("./")) return entry.icon;
  const suffix = `extension-sources/icons/${extensionIconAssetName(entry)}`;
  const asset = files.find((file) => (file as File).name?.replaceAll("\\", "/").endsWith(suffix));
  if (asset) return `data:image/svg+xml;base64,${Buffer.from(await asset.arrayBuffer()).toString("base64")}`;
  // Source development reads only a matching repository-owned catalog entry.
  const packaged = packagedExtensionCatalog.extensions.find(
    (source) =>
      source.installName === entry.installName &&
      source.origin.url === entry.origin.url &&
      source.origin.path === entry.origin.path &&
      source.origin.ref === entry.origin.ref &&
      source.extensionId === entry.extensionId &&
      source.icon === entry.icon,
  );
  if (!packaged) return undefined;
  try {
    return readExtensionIcon(resolve(import.meta.dir, "../../../../..", entry.origin.path), entry.icon);
  } catch {
    return undefined;
  }
};
