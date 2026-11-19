import { expect, test } from "bun:test";
import { createQueryReadScheduler } from "./query-read-scheduler";

const clock = () => {
  let now = 0;
  const pending = new Map<symbol, { at: number; task(): void }>();
  return {
    schedule(task: () => void, delay: number) {
      const id = Symbol();
      pending.set(id, { at: now + delay, task });
      return () => {
        pending.delete(id);
      };
    },
    advance(milliseconds: number) {
      const end = now + milliseconds;
      for (;;) {
        const next = [...pending].filter(([, item]) => item.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        pending.delete(next[0]);
        now = next[1].at;
        next[1].task();
      }
      now = end;
    },
    pending: () => pending.size,
  };
};

test("automatic event bursts share a fixed deadline instead of postponing reads", async () => {
  const timer = clock();
  let reads = 0;
  const schedule = createQueryReadScheduler(
    () => true,
    async () => {
      reads++;
    },
    { windowMs: 25, schedule: timer.schedule },
  );
  schedule();
  await Promise.resolve();
  expect(reads).toBe(0);
  for (let event = 0; event < 4; event++) {
    timer.advance(5);
    schedule();
  }
  expect(reads).toBe(0);
  timer.advance(5);
  expect(reads).toBe(1);
  schedule();
  timer.advance(25);
  expect(reads).toBe(2);
  expect(timer.pending()).toBe(0);
});

test("retirement and explicit admission cancel pending automatic reads", () => {
  const timer = clock();
  let reads = 0;
  const schedule = createQueryReadScheduler(
    () => true,
    async () => {
      reads++;
    },
    { windowMs: 25, schedule: timer.schedule },
  );
  schedule();
  schedule.cancel();
  timer.advance(100);
  expect(reads).toBe(0);
  expect(timer.pending()).toBe(0);
  schedule();
  timer.advance(25);
  expect(reads).toBe(1);
});

test("a queued event cannot read after the owner loses automatic observation", () => {
  const timer = clock();
  let active = true;
  let reads = 0;
  const schedule = createQueryReadScheduler(
    () => active,
    async () => {
      reads++;
    },
    { windowMs: 25, schedule: timer.schedule },
  );
  schedule();
  active = false;
  timer.advance(25);
  expect(reads).toBe(0);
});
