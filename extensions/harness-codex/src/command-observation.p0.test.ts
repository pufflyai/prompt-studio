import { expect, test } from "bun:test";
import { createCodexCommandObservation } from "./command-observation";

test("unclaimed command recovery shares narrow reads, becomes quiet under native coverage and stops on release", async () => {
  const scheduled = new Set<() => void>();
  const schedule = (run: () => void) => {
    scheduled.add(run);
    return () => scheduled.delete(run);
  };
  let covered = false;
  let value = "initial";
  let reads = 0;
  let changes = 0;
  const observation = createCodexCommandObservation({
    covered: () => covered,
    read: async () => {
      reads++;
      return value;
    },
    changed: () => changes++,
    schedule,
  });
  await Bun.sleep(0);
  expect({ reads, changes, timers: scheduled.size }).toEqual({ reads: 1, changes: 1, timers: 1 });
  const tick = async () => {
    const run = [...scheduled][0]!;
    scheduled.delete(run);
    run();
    await Bun.sleep(0);
  };
  await tick();
  expect({ reads, changes }).toEqual({ reads: 2, changes: 1 });
  value = "external plan";
  await tick();
  expect(changes).toBe(2);
  covered = true;
  observation.changed();
  expect(scheduled.size).toBe(0);
  covered = false;
  observation.changed();
  expect(scheduled.size).toBe(1);
  observation.close();
  expect(scheduled.size).toBe(0);
});

test("closing an unclaimed observation aborts its actual probe and fences a late result", async () => {
  const reply = Promise.withResolvers<string>();
  let signal: AbortSignal | undefined;
  let changes = 0;
  const observation = createCodexCommandObservation({
    covered: () => false,
    read: (current) => {
      signal = current;
      return reply.promise;
    },
    changed: () => changes++,
  });
  observation.close();
  expect(signal?.aborted).toBe(true);
  reply.resolve("late");
  await Bun.sleep(0);
  expect(changes).toBe(0);
});
