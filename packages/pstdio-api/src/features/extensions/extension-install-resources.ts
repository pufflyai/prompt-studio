import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { extensionStorageDirectory } from "pstdio-extensions";
import { expandHomePath, resolvePstdioHome } from "pstdio-paths";
import { isLocalExtensionSource } from "./extension-install-paths";
import type { InstallExtensionSourceInput } from "./install-extension-source-types";

// Resolve existing ancestors too: a new target under a symlinked root must
// conflict with a peer reading its canonical path. Conservative case/Unicode
// folding also covers case-insensitive host filesystems.
const pathKey = (path: string) => `path:${path.replaceAll("\\", "/").normalize("NFD").toLowerCase()}`;
const resourcePaths = (path: string) => {
  const absolute = resolve(path);
  let parent = absolute;
  while (true) {
    try {
      const canonical = resolve(realpathSync(parent), relative(parent, absolute));
      return [pathKey(absolute), pathKey(canonical)];
    } catch {
      const next = dirname(parent);
      if (next === parent) return [pathKey(absolute)];
      parent = next;
    }
  }
};

export const extensionInstallResources = (input: InstallExtensionSourceInput) => {
  const name = input.installName;
  // Unknown manifest-derived names and nonportable filesystem aliases retain
  // exclusive admission. No manifest is loaded on the API thread.
  if (!name || !/^[a-z0-9_](?:[a-z0-9._-]*[a-z0-9_-])?$/i.test(name)) return undefined;
  const names = new Set([name]);
  try {
    names.add(extensionStorageDirectory(name));
  } catch {
    /* A custom install name is not necessarily an extension ID. */
  }
  const roots = [join(resolvePstdioHome(input), "extensions")];
  if (input.repoPath) roots.push(join(input.repoPath, ".pstdio", "extensions"));
  // Scope can come from the manifest; reserve both possible destinations.
  const resources = roots.flatMap((root) => [...names].flatMap((name) => resourcePaths(join(root, name))));
  if (isLocalExtensionSource(input.source)) {
    const home = input.homedir?.() ?? homedir();
    const source = input.source.startsWith("~\\")
      ? join(home, input.source.slice(2))
      : expandHomePath(input.source, home);
    resources.push(...resourcePaths(source));
  }
  return [...new Set(resources)];
};
