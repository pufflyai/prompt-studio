import { rename } from "node:fs/promises";

const sharingRetryDelays = [10, 20, 40, 80, 160];

// Temporary Windows sharing workaround; see ADR 0104. The caller keeps the database lock throughout.
export const renamePgliteHome = async (source: string, target: string, signal?: AbortSignal) => {
  let attempt = 0;
  while (true) {
    signal?.throwIfAborted();
    try {
      await rename(source, target);
      return;
    } catch (error) {
      const delay = sharingRetryDelays[attempt++];
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform !== "win32" || delay === undefined || !["EPERM", "EACCES", "EBUSY"].includes(code ?? "")) {
        throw error;
      }
      await Bun.sleep(delay);
    }
  }
};
