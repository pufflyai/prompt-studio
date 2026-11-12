import { expect, test } from "bun:test";
import { settleWorkspaceDiffReads } from "./workspace-diff-reads";

test("cancelled diff admission drains all entered children and never starts queued siblings", async () => {
  const controller = new AbortController();
  const entered = Promise.withResolvers<void>();
  const releases = Array.from({ length: 6 }, () => Promise.withResolvers<void>());
  const started: number[] = [];
  let settled = false;
  const pending = settleWorkspaceDiffReads(
    releases.map((release, index) => async () => {
      started.push(index);
      if (started.length === 4) entered.resolve();
      await release.promise;
      return index;
    }),
    controller.signal,
  );
  const observed = pending.finally(() => {
    settled = true;
  });
  void observed.catch(() => {});
  try {
    await entered.promise;
    controller.abort();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    releases[0]!.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    for (const release of releases) release.resolve();
    await expect(observed).rejects.toMatchObject({ name: "AbortError" });
    expect(started).toEqual([0, 1, 2, 3]);
  } finally {
    controller.abort();
    for (const release of releases) release.resolve();
    await observed.catch(() => {});
  }
});
