import { readFileSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import { createDirectoryTreeWatcher } from "pstdio-extensions";
import { createRecoveryPolicy } from "./policy";

// Each folder costs one OS watch on Linux, and that limit is shared with every process.
const maxFolders = 2_000;
// Folders past the watch limit are reconciled by a periodic full scan instead.
const unwatchedRescanMs = 10 * 60_000;

const policyAt = (root: string) => {
  try {
    return createRecoveryPolicy(readFileSync(join(root, ".pstignore"), "utf8"));
  } catch {
    return createRecoveryPolicy(null);
  }
};

/** Change hints for one project folder. Excluded paths are not watched or reported.
 * A `.pstignore` change or watch error is a loss: the scheduler rescans and watches again
 * with the current policy. */
export const watchRecoveryFolder = (root: string, changed: () => void, lost: () => void) => {
  const policy = policyAt(root);
  const path = (absolute: string) => {
    const rel = relative(root, absolute);
    return rel && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`) ? rel.split(sep).join("/") : null;
  };
  let rescan: ReturnType<typeof setInterval> | undefined;
  const tree = createDirectoryTreeWatcher({
    root,
    maxDirectories: maxFolders,
    skipDirectory: (absolute) => {
      const rel = path(absolute);
      return rel !== null && !policy.classify(rel, true).included;
    },
    onDirectoryLimit: () => {
      rescan ??= setInterval(changed, unwatchedRescanMs);
      rescan.unref?.();
    },
    onEvent: (_type, absolute) => {
      const rel = path(absolute);
      if (rel === ".pstignore") lost();
      else if (rel === null || policy.classify(rel).included) changed();
    },
    onError: lost,
  });
  return {
    close() {
      clearInterval(rescan);
      tree.close();
    },
  };
};
