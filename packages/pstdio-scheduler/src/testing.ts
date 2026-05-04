import type { CronFactory, CronHandle } from "./types";

type Entry = {
  cron: string;
  handler: () => void | Promise<void>;
  running: boolean;
};

export type TestCronDriver = {
  factory: CronFactory;
  size: () => number;
  fireAll: () => Promise<void>;
};

export const createTestCronDriver = (): TestCronDriver => {
  const entries = new Map<symbol, Entry>();

  const factory: CronFactory = (cron, handler) => {
    const id = Symbol("test-cron");
    entries.set(id, { cron, handler, running: false });
    const handle: CronHandle = {
      stop: () => {
        entries.delete(id);
      },
    };
    return handle;
  };

  const fireAll = async () => {
    const promises: Promise<void>[] = [];
    for (const entry of entries.values()) {
      if (entry.running) continue;
      entry.running = true;
      const p = (async () => {
        try {
          await entry.handler();
        } finally {
          entry.running = false;
        }
      })();
      promises.push(p);
    }
    await Promise.allSettled(promises);
  };

  return {
    factory,
    fireAll,
    size: () => entries.size,
  };
};
