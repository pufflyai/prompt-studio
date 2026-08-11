import { relative, resolve } from "node:path";

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
