import { expect, test } from "bun:test";
import { createLiveRead } from "./live-read";

test("a burst of changes waits for one fresh read and never publishes an obsolete value", async () => {
  const pending: Array<(value: number) => void> = [];
  const values: number[] = [];
  const errors: unknown[] = [];
  const reader = createLiveRead(() => new Promise<number>((resolve) => pending.push(resolve)), {
    onValue: (value) => values.push(value),
    onError: (error) => errors.push(error),
  });
  const first = reader.refresh();
  for (let event = 0; event < 20; event++) void reader.refresh();
  expect(pending).toHaveLength(1);
  pending.shift()!(1);
  await Promise.resolve();
  expect(values).toEqual([]);
  expect(pending).toHaveLength(1);
  pending.shift()!(2);
  await first;
  expect(values).toEqual([2]);
  expect(errors).toEqual([]);
});

test("a failed read can refresh again, while closing the view stops queued reads", async () => {
  const failure = new Error("Read failed");
  const errors: unknown[] = [];
  let reads = 0;
  let finish: (value: number) => void = () => {};
  const values: number[] = [];
  const reader = createLiveRead(
    async () => {
      if (++reads === 1) throw failure;
      return new Promise<number>((resolve) => {
        finish = resolve;
      });
    },
    { onValue: (value) => values.push(value), onError: (error) => errors.push(error) },
  );
  await reader.refresh();
  expect(errors).toEqual([failure]);
  const pending = reader.refresh();
  void reader.refresh();
  reader.dispose();
  finish(2);
  await pending;
  expect(reads).toBe(2);
  expect(values).toEqual([]);
});
