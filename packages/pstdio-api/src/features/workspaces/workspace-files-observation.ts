import { relative, sep } from "node:path";
import { createDirectoryTreeWatcher, type WatchDirectory } from "pstdio-extensions";

/** Change hints only; finite tree reads remain the authority. Coverage recovery follows ADR 0140. */
export const watchWorkspaceFiles = async (
  root: string,
  changed: () => void,
  watch?: WatchDirectory,
  startupGap = process.platform === "darwin",
) => {
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
  const excluded = (path: string) => relative(root, path).split(sep).includes(".git");
  const observer = createDirectoryTreeWatcher({
    root,
    watch,
    maxDirectories: 2_000,
    skipDirectory: excluded,
    onEvent: (_type, path) => {
      if (!excluded(path)) hint();
    },
    onError: gap,
    onDirectoryLimit: gap,
  });
  const startup = startupGap ? setTimeout(hint, 100) : undefined;
  startup?.unref?.();
  return {
    close() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      clearTimeout(startup);
      clearInterval(recovery);
      observer.close();
    },
  };
};
