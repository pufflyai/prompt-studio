import { expect, test } from "bun:test";
import { createWatchdog } from "./watchdog";

test("a host that was blocked does not blame a worker whose answers are still unread", async () => {
  const reasons: string[] = [];
  let watchdog: ReturnType<typeof createWatchdog> | undefined;
  // The worker answers every ping on the next turn of the host's event loop.
  watchdog = createWatchdog(
    () => setTimeout(() => watchdog?.answered(0), 0),
    (reason) => reasons.push(reason),
    { heartbeatMs: 20, unresponsiveMs: 100 },
  );
  try {
    await Bun.sleep(60);
    const until = performance.now() + 300;
    while (performance.now() < until);
    await Bun.sleep(100);
    expect(reasons).toEqual([]);
  } finally {
    watchdog.stop();
  }
});

test("a worker that stops answering is stopped", async () => {
  const reasons: string[] = [];
  const watchdog = createWatchdog(
    () => {},
    (reason) => reasons.push(reason),
    { heartbeatMs: 20, unresponsiveMs: 100 },
  );
  try {
    await Bun.sleep(200);
    expect(reasons).toHaveLength(1);
  } finally {
    watchdog.stop();
  }
});
