import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { createExtensionIgnoreMatcher } from "pstdio-extensions/authoring";

const runtimeSources = async (root: string) => {
  const entries: { path: string; sha256: string }[] = [];
  const matcher = createExtensionIgnoreMatcher(root);
  const visit = async (path: string) => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (matcher.ignores(relative(root, full))) continue;
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile())
        entries.push({
          path: relative(root, full),
          sha256: createHash("sha256")
            .update(await readFile(full))
            .digest("hex"),
        });
    }
  };
  entries.push({
    path: "extension.ts",
    sha256: createHash("sha256")
      .update(await readFile(join(root, "extension.ts")))
      .digest("hex"),
  });
  await visit(join(root, "src"));
  return entries.sort((a, b) => a.path.localeCompare(b.path));
};

// The host installs a source copy. A worktree SHA alone cannot identify what the app executes.
export const verifyPlannerComparisonSource = async (
  expectedPath: string,
  inventory: {
    extensions: { extensionId: string; sourcePath: string; updateAvailable: boolean; lastLoadedAt: string | null }[];
  },
  extensionId: string,
) => {
  const installed = inventory.extensions.find((entry) => entry.extensionId === extensionId);
  assert(installed, "Planner must be installed");
  assert(!installed.updateAvailable, "Reload the installed Planner source before measuring");
  const expected = await runtimeSources(resolve(expectedPath));
  const actual = await runtimeSources(installed.sourcePath);
  assert.deepEqual(actual, expected, "Installed Planner source differs from the comparison revision");
  return {
    expectedPath: resolve(expectedPath),
    installedPath: installed.sourcePath,
    lastLoadedAt: installed.lastLoadedAt,
    files: actual.length,
    sha256: createHash("sha256").update(JSON.stringify(actual)).digest("hex"),
  };
};
