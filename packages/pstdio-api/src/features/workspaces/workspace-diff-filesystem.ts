import { relative, resolve, sep } from "node:path";
import { createDirectoryTreeWatcher, type WatchDirectory } from "pstdio-extensions";
import { git } from "pstdio-wt";

const ignored = (path: string) => {
  const first = path.split(sep)[0];
  return first === "objects" || first === "logs";
};

/** A change hint, never a second Git/document reader. See ADR 0140 for gap-only recovery. */
export const watchWorkspaceDiffFiles = async (root: string, changed: () => void, watch?: WatchDirectory) => {
  const gitDirectory = resolve(root, await git(root, ["rev-parse", "--git-dir"]));
  const commonDirectory = resolve(root, await git(root, ["rev-parse", "--git-common-dir"]));
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let recovery: ReturnType<typeof setInterval> | undefined;
  const hint = () => {
    if (closed || timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!closed) changed();
    }, 100);
    timer.unref?.();
  };
  const gap = () => {
    hint();
    if (closed || recovery) return;
    recovery = setInterval(hint, 30_000);
    recovery.unref?.();
  };
  const roots = [...new Set([root, gitDirectory, commonDirectory])];
  const watches = roots.map((watchRoot) =>
    createDirectoryTreeWatcher({
      root: watchRoot,
      watch,
      maxDirectories: watchRoot === root ? 1_800 : 100,
      skipDirectory: (path) => {
        const rel = relative(watchRoot, path);
        if (watchRoot === root) return rel.split(sep)[0] === ".git";
        return ignored(rel) || (watchRoot === commonDirectory && rel.split(sep)[0] === "worktrees");
      },
      onEvent: (_type, path) => {
        const rel = relative(watchRoot, path);
        const excluded =
          watchRoot === root
            ? rel.split(sep)[0] === ".git"
            : ignored(rel) || (watchRoot === commonDirectory && rel.split(sep)[0] === "worktrees");
        if (!excluded) hint();
      },
      onError: gap,
      onDirectoryLimit: gap,
    }),
  );
  return {
    close() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      clearInterval(recovery);
      for (const watch of watches) watch.close();
    },
  };
};
