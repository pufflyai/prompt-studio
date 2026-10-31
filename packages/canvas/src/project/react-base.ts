import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CanvasEntry } from "./manifest";

// The React a folder resolves, when it resolves both `react` and `react-dom`.
const reactAt = (folder: string) => {
  try {
    const manifest = Bun.resolveSync("react/package.json", folder);
    Bun.resolveSync("react-dom/package.json", folder);
    return {
      folder,
      path: realpathSync(dirname(manifest)),
      version: JSON.parse(readFileSync(manifest, "utf8")).version,
    };
  } catch {
    return undefined;
  }
};

/**
 * The folder every frame resolves React from, so a page loads one React: the project root, or in a
 * monorepo without a root install, the folder most canvas files resolve React from.
 */
export const reactBase = (root: string, canvases: CanvasEntry[]) => {
  if (reactAt(root)) return root;
  const found = canvases.flatMap((canvas) => reactAt(dirname(join(root, canvas.id))) ?? []);
  // Without any React, each canvas reports the missing package itself.
  if (!found.length) return root;
  const versions = [...new Set(found.map((entry) => entry.version))];
  if (versions.length > 1)
    throw new Error(
      `Canvas files resolve different React versions (${versions.join(", ")}). Frames share one React, so install one React version for every canvas file.`,
    );
  const counts = new Map<string, number>();
  for (const entry of found) counts.set(entry.path, (counts.get(entry.path) ?? 0) + 1);
  const [mostUsed] = [...counts].sort((a, b) => b[1] - a[1])[0]!;
  return found.find((entry) => entry.path === mostUsed)!.folder;
};
