import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { openInlineThreadPages } from "./review-thread-page";

test("submission maps only selected open inline threads in bounded pages across state writes", async () => {
  const storage = createMemoryStorage();
  for (let i = 0; i < 306; i++)
    await storage.collection("planner-review-threads").put(`thread-${String(i).padStart(3, "0")}`, {
      id: `thread-${String(i).padStart(3, "0")}`,
      workspaceId: i < 203 ? "selected" : "other",
      state: "open",
      side: "head",
      path: "file.ts",
      startLine: 1,
      endLine: 2,
      originalHeadSha: "old",
    });
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    list: async () => {
      throw Error(`Unbounded ${name}`);
    },
  });
  let changed = 0,
    largest = 0;
  for await (const page of openInlineThreadPages(storage, "selected", "new")) {
    largest = Math.max(largest, page.length);
    for (const thread of page) {
      await storage.collection("planner-review-threads").put(thread.id, { ...thread, state: "outdated" });
      changed++;
    }
  }
  expect(changed).toBe(203);
  expect(largest).toBeLessThanOrEqual(100);
  expect(await collection("planner-review-threads").get("thread-203")).toMatchObject({ state: "open" });
});
