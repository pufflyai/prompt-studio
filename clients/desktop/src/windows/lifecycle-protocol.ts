import { readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

export const LIFECYCLE_SCHEME = "pstdio";
export const LIFECYCLE_URL = `${LIFECYCLE_SCHEME}://lifecycle/index.html`;

export const resolveLifecycleAssetPath = (requestUrl: string, rendererRoot: string) => {
  try {
    if (/%2e/i.test(requestUrl)) return null;
    const url = new URL(requestUrl);
    if (url.protocol !== `${LIFECYCLE_SCHEME}:` || url.host !== "lifecycle") {
      return null;
    }

    const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const assetPath = resolve(rendererRoot, `.${pathname}`);
    const relativePath = relative(rendererRoot, assetPath);
    if (!relativePath || relativePath.startsWith("..") || relativePath.includes(":")) return null;
    return assetPath;
  } catch {
    return null;
  }
};

const assetContentTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

export const readLifecycleAsset = async (requestUrl: string, rendererRoot: string) => {
  const assetPath = resolveLifecycleAssetPath(requestUrl, rendererRoot);
  if (!assetPath) return new Response(null, { status: 404 });
  try {
    const body = await readFile(assetPath);
    return new Response(new Uint8Array(body), {
      headers: { "content-type": assetContentTypes[extname(assetPath)] ?? "application/octet-stream" },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 404 });
    throw error;
  }
};
