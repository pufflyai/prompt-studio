import { expect, test } from "bun:test";
import { createFrameStartupQueue } from "./startup-queue";

test("selected and visible frames start first while startup concurrency stays bounded", async () => {
  const queue = createFrameStartupQueue();
  const starts: number[] = [];
  const jobs = Array.from({ length: 6 }, (_, index) => queue.enqueue(() => starts.push(index), 2));
  jobs[5].prioritize(0);
  jobs[4].prioritize(1);
  await Bun.sleep(5);
  expect(starts).toEqual([5, 4, 0, 1]);
  jobs[5].finish();
  await Bun.sleep(5);
  expect(starts).toEqual([5, 4, 0, 1, 2]);
  queue.dispose();
});

test("cancelled frames do not start and releasing a slot is idempotent", async () => {
  const queue = createFrameStartupQueue();
  const starts: number[] = [];
  const jobs = Array.from({ length: 7 }, (_, index) => queue.enqueue(() => starts.push(index), 2));
  jobs[4].cancel();
  await Bun.sleep(5);
  jobs[0].finish();
  jobs[0].finish();
  await Bun.sleep(5);
  expect(starts).toEqual([0, 1, 2, 3, 5]);
  queue.dispose();
  jobs[1].finish();
  await Bun.sleep(5);
  expect(starts).not.toContain(6);
});
