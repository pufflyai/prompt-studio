import { expect, test } from "bun:test";
import { createFrameStartupQueue } from "./startup-queue";

test("a populated canvas bounds simultaneous runtime startup and starts every waiting frame", () => {
  const queue = createFrameStartupQueue();
  const starts: number[] = [];
  const jobs = Array.from({ length: 24 }, (_, index) => queue.enqueue(() => starts.push(index)));
  expect(starts).toEqual([0, 1, 2, 3]);
  for (const job of jobs) job.finish();
  expect(starts).toEqual(Array.from({ length: 24 }, (_, index) => index));
});

test("removed frames release startup work once and cancelled canvases stop waiting frames", () => {
  const queue = createFrameStartupQueue();
  const starts: number[] = [];
  const jobs = Array.from({ length: 8 }, (_, index) => queue.enqueue(() => starts.push(index)));
  jobs[4].finish();
  jobs[0].finish();
  jobs[0].finish();
  expect(starts).toEqual([0, 1, 2, 3, 5]);
  queue.dispose();
  jobs[1].finish();
  queue.enqueue(() => starts.push(8));
  expect(starts).toEqual([0, 1, 2, 3, 5]);
});
