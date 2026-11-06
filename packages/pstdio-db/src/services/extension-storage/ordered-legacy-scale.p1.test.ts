import { expect, test } from "bun:test";
import { peers } from "./ordered-legacy-pending.fixture";

for (const overlapping of [false, true])
  test(`later pending growth ${overlapping ? "overlapping" : "outside"} an earlier legacy frame preserves its authored values within existing limits`, async () => {
    const { first, second } = await peers();
    const count = 32;
    await first.legacy.commit({
      operationId: "seed",
      edits: Array.from({ length: count }, (_, index) => ({
        recordId: `card-${index}`,
        replace: { title: "base", body: "x" },
      })),
    });
    await first.oldSync.synchronize();
    await second.oldSync.synchronize();
    await second.legacy.commit({
      operationId: "early-batch",
      edits: Array.from({ length: count }, (_, index) => ({
        recordId: `card-${index}`,
        replace: { title: "batch", body: overlapping ? "earlier" : "x" },
      })),
    });
    const body = "y".repeat(150 * 1024);
    for (let index = 0; index < count; index++)
      await second.legacy.commit({
        operationId: `later-${index}`,
        edits: [{ recordId: `card-${index}`, replace: { title: "batch", body } }],
      });
    const a = first.upgrade();
    const b = second.upgrade();
    await a.sync.synchronize();
    await b.sync.synchronize();
    await a.sync.synchronize();
    for (const peer of [a, b]) {
      expect((await peer.records.list()).length).toBe(count);
      for (const index of [0, count - 1])
        expect((await peer.records.read(`card-${index}`)).value).toEqual({ title: "batch", body });
    }
  }, 60_000);
