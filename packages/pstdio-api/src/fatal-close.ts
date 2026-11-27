import { waitForDatabaseWorkersIdle } from "pstdio-db";
import { apiLogger } from "./lib/logger";

const FATAL_CLOSE_TIMEOUT_MS = 5_000;
// A statement already running in the database thread may finish first; exit would stop it mid-write.
const FATAL_STATEMENT_WAIT_MS = 60_000;

// Exiting while PGlite is open can corrupt its WAL (lessons 0002 and 0014), so a fatal exit waits
// for close. The deadline keeps a close that hangs from keeping a broken process alive.
export const closeBeforeFatalExit = async (close: () => Promise<void>, timeoutMs = FATAL_CLOSE_TIMEOUT_MS) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  const closing = close().catch((err) =>
    apiLogger.error({ err, event: "api.fatal_close.error" }, "API failed to close before a fatal exit"),
  );
  await Promise.race([closing, deadline]);
  clearTimeout(timer);
  await waitForDatabaseWorkersIdle(FATAL_STATEMENT_WAIT_MS);
};
