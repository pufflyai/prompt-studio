import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { z } from "@hono/zod-openapi";
import { expandHomePath, resolvePstdioHome } from "pstdio-paths";
import packagedCatalogData from "../../../files/extension-catalog.json";

const gitOriginSchema = z.object({
  kind: z.literal("git"),
  url: z.string().url(),
  path: z.string().min(1),
  ref: z.string().min(1),
});

const extensionCatalogEntrySchema = z.object({
  installName: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string(),
  origin: gitOriginSchema,
  publisher: z.string().min(1).optional(),
  default: z.boolean(),
});

const extensionCatalogSchema = z.object({
  version: z.literal(1),
  extensions: z.array(extensionCatalogEntrySchema),
});

export type ExtensionCatalog = z.infer<typeof extensionCatalogSchema>;
export type ExtensionCatalogEntry = z.infer<typeof extensionCatalogEntrySchema>;
export type GitExtensionOrigin = z.infer<typeof gitOriginSchema>;

export const parseExtensionCatalog = (value: unknown) => {
  const catalog = extensionCatalogSchema.parse(value);
  const names = new Set<string>();
  for (const entry of catalog.extensions) {
    if (names.has(entry.installName)) {
      throw new Error(`Duplicate extension catalog install name: ${entry.installName}`);
    }
    names.add(entry.installName);
  }
  return catalog;
};

const parseCatalogText = (text: string) => parseExtensionCatalog(JSON.parse(text) as unknown);

export const packagedExtensionCatalog = parseExtensionCatalog(packagedCatalogData);

const writeAtomic = async (path: string, content: string) => {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, path);
};

const readCachedCatalog = async (cachePath: string) => parseCatalogText(await readFile(cachePath, "utf8"));

interface LoadExtensionCatalogInput {
  env?: Record<string, string | undefined>;
  fetch?: (url: string) => Promise<Pick<Response, "ok" | "status" | "text">>;
  pstdioHome?: string;
}

export const loadExtensionCatalog = async (input: LoadExtensionCatalogInput = {}) => {
  const env = input.env ?? process.env;
  const configured = env.PSTDIO_EXTENSION_CATALOG?.trim();
  if (!configured) return packagedExtensionCatalog;

  const pstdioHome = input.pstdioHome ?? resolvePstdioHome({ env });
  const cacheName = createHash("sha256").update(configured).digest("hex");
  const cachePath = join(pstdioHome, "cache", "extension-catalog", `${cacheName}.json`);
  if (configured.startsWith("https://")) {
    try {
      const response = await (input.fetch ?? globalThis.fetch)(configured);
      if (!response.ok) throw new Error(`Catalog request failed with status ${response.status}`);
      const text = await response.text();
      const catalog = parseCatalogText(text);
      await writeAtomic(cachePath, text);
      return catalog;
    } catch (error) {
      try {
        return await readCachedCatalog(cachePath);
      } catch {
        throw error;
      }
    }
  }

  if (configured.includes("://")) {
    throw new Error("PSTDIO_EXTENSION_CATALOG accepts only local paths or https URLs");
  }
  const home = env.HOME?.trim();
  const expanded = expandHomePath(configured, home);
  const path = isAbsolute(expanded) ? expanded : resolve(expanded);
  return parseCatalogText(await readFile(path, "utf8"));
};

let catalogPromise: Promise<ExtensionCatalog> | undefined;

export const getExtensionCatalog = () => {
  catalogPromise ??= loadExtensionCatalog();
  return catalogPromise;
};

export const findExtensionCatalogEntry = async (installName: string) =>
  (await getExtensionCatalog()).extensions.find((entry) => entry.installName === installName);
