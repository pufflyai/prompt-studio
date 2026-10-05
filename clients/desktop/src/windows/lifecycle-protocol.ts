import { readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import type { DesktopStartupAppearance } from "../desktop-api";

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

// Sets the classes, attributes, and token variables of `applyThemePreference` from @pstdio/ui,
// so the first frame has the theme's mode and colors. Hydration then applies the full theme,
// including tokens that function derives. The store accepts only values safe in these attributes.
const themeDocumentAttributes = (appearance: DesktopStartupAppearance) => {
  const tokens = Object.entries(appearance.tokens).map(
    ([path, value]) => ` --chakra-${path.replaceAll(".", "-")}: ${value};`,
  );
  const style = `color-scheme: ${appearance.mode};${tokens.join("")}`;
  return ` class="${appearance.mode} theme-${appearance.themeId}" data-theme="${appearance.themeId}" data-color-mode="${appearance.mode}" style="${style}"`;
};

export const readLifecycleAsset = async (
  requestUrl: string,
  rendererRoot: string,
  appearance: DesktopStartupAppearance | undefined,
) => {
  const assetPath = resolveLifecycleAssetPath(requestUrl, rendererRoot);
  if (!assetPath) return new Response(null, { status: 404 });
  try {
    const file = await readFile(assetPath);
    // The first frame must use the saved theme before any script runs.
    const body =
      appearance && extname(assetPath) === ".html"
        ? Buffer.from(
            // A replacer function keeps `$` patterns in theme values literal.
            file
              .toString("utf8")
              .replace(
                /<html([^>]*)>/,
                (_tag, attributes) => `<html${attributes}${themeDocumentAttributes(appearance)}>`,
              ),
          )
        : file;
    return new Response(new Uint8Array(body), {
      headers: { "content-type": assetContentTypes[extname(assetPath)] ?? "application/octet-stream" },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 404 });
    throw error;
  }
};
