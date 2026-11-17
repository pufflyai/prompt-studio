import { extname } from "node:path";
import { relativeEmbeddedFileName } from "pstdio-paths";

type EmbeddedFile = Blob & { name: string };

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain",
  ".map": "application/json",
};

export const resolveMimeType = (filePath: string) => MIME_TYPES[extname(filePath)] ?? "application/octet-stream";

// Bun.embeddedFiles is a static array property (not a function) in Bun v1.2+
const getEmbeddedFiles = (): EmbeddedFile[] => {
  try {
    const files = (Bun as Record<string, unknown>).embeddedFiles;
    if (Array.isArray(files)) return files as EmbeddedFile[];
  } catch {
    // not available
  }
  return [];
};

export const loadEmbeddedAssets = () => {
  const assets = new Map<string, Blob>();

  for (const file of getEmbeddedFiles()) {
    const name = relativeEmbeddedFileName(file.name, "pstdio-dashboard/dist");
    if (name !== undefined) assets.set(name, file);
  }

  return assets;
};

export const isCompiledBinary = () => getEmbeddedFiles().length > 0;
