import { expect, test } from "bun:test";
import { runExtensionUpgrades } from "./run-extension-upgrades";

test("starts two upgrades and keeps the rest queued until an active one finishes", async () => {
  const gates = [0, 1, 2].map(() => Promise.withResolvers<void>());
  const started: number[] = [];
  const finished: number[] = [];
  const batch = runExtensionUpgrades([0, 1, 2], async (target) => {
    started.push(target);
    await gates[target]!.promise;
    finished.push(target);
  });
  expect(started).toEqual([0, 1]);
  gates[1]!.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(started).toEqual([0, 1, 2]);
  expect(finished).toEqual([1]);
  gates[0]!.resolve();
  gates[2]!.resolve();
  await batch;
  expect(finished).toEqual([1, 0, 2]);
});
