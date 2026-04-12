import { existsSync, watch } from "node:fs";
import { basename, dirname } from "node:path";

export const waitForPath = (path: string, timeoutMs = 1_000) =>
  new Promise<boolean>((resolve) => {
    if (existsSync(path)) {
      resolve(true);
      return;
    }

    const watcher = watch(dirname(path), () => {
      if (!existsSync(path)) {
        return;
      }

      cleanup();
      resolve(true);
    });

    const cleanup = () => {
      clearTimeout(timeout);
      watcher.close();
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve(existsSync(path));
    }, timeoutMs);

    watcher.on("error", () => {
      cleanup();
      resolve(existsSync(path));
    });

    // Some platforms can emit a change event before the file is fully visible by name.
    const targetName = basename(path);
    watcher.on("change", (_eventType, filename) => {
      if (filename && filename !== targetName) {
        return;
      }

      if (!existsSync(path)) {
        return;
      }

      cleanup();
      resolve(true);
    });
  });
