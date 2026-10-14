import { expect, test } from "bun:test";
import { createControlSaveQueue } from "./control-save-queue";

test("rapid control edits finish in order without overlapping writes", async () => {
  const enqueue = createControlSaveQueue();
  const saved: string[] = [];
  let release!: () => void;
  const firstWrite = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = enqueue(async () => {
    await firstWrite;
    saved.push("first");
  });
  const second = enqueue(async () => {
    saved.push("second");
  });
  await Promise.resolve();
  expect(saved).toEqual([]);
  release();
  await Promise.all([first, second]);
  expect(saved).toEqual(["first", "second"]);
});

test("a rejected save does not stop later control edits", async () => {
  const enqueue = createControlSaveQueue();
  const first = enqueue(async () => {
    throw new Error("Invalid selection");
  });
  const second = enqueue(async () => "saved");
  await expect(first).rejects.toThrow("Invalid selection");
  expect(await second).toBe("saved");
});
