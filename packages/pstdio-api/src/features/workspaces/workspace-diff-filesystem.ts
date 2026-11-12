import { relative, resolve, sep } from "node:path";
import { createDirectoryTreeWatcher, type WatchDirectory } from "pstdio-extensions";
import { git } from "pstdio-wt";

const ignored = (path: string) => {
  const first = path.split(sep)[0];
  return first === "objects" || first === "logs";
};

/** A change hint, never a second Git/document reader. See ADR 0140 for gap-only recovery. */
export const watchWorkspaceDiffFiles = async (
  root: string,
  changed: () => void,
  watch?: WatchDirectory,
  startupGap = process.platform === "darwin",
  signal?: AbortSignal,
) => {
  signal?.throwIfAborted();
  const [gitPath, commonPath] = await Promise.all([
    git(root, ["rev-parse", "--git-dir"]),
    git(root, ["rev-parse", "--git-common-dir"]),
  ]);
  const gitDirectory = resolve(root, gitPath);
  const commonDirectory = resolve(root, commonPath);
  signal?.throwIfAborted();
  let closed = false;
  let admitted = !startupGap;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let recovery: ReturnType<typeof setInterval> | undefined;
  const hint = () => {
    if (closed || !admitted || timer) return;
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
  const admission = Promise.withResolvers<void>();
  // Keep the existing 100 ms startup grace + 100 ms reconciliation window before the first read.
  const startup = startupGap
    ? setTimeout(() => {
        admitted = true;
        admission.resolve();
      }, 200)
    : undefined;
  startup?.unref?.();
  if (!startupGap) admission.resolve();
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    clearTimeout(startup);
    clearInterval(recovery);
    signal?.removeEventListener("abort", close);
    for (const watch of watches) watch.close();
    admission.resolve();
  };
  signal?.addEventListener("abort", close, { once: true });
  if (signal?.aborted) close();
  await admission.promise;
  signal?.throwIfAborted();
  return { close };
};
