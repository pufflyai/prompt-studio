import { expect, test } from "bun:test";
import type { GuestHost } from "@pstdio/sdk/extensions";
import { createTimelineStorage } from "./timeline-storage";

test("Timeline state restores from project preferences and saves rapid changes in order", async () => {
  let saved: Record<string, string> = { collection: "previous selection" };
  const scopes: unknown[] = [];
  const writes: Record<string, string>[] = [];
  const host = {
    async call(method: string, params: { name: string; scope: unknown; value?: Record<string, string> }) {
      expect(params.name).toBe("timelineViewState");
      scopes.push(params.scope);
      if (method === "preferences.get") return saved;
      await Promise.resolve();
      saved = params.value!;
      writes.push(saved);
      return { ok: true };
    },
  } as GuestHost;
  const errors: unknown[] = [];
  const storage = await createTimelineStorage(host, (error) => errors.push(error));
  expect(storage.getItem("collection")).toBe("previous selection");
  expect(storage.getItem("new")).toBeNull();
  const first = storage.setItem("collection", "first selection");
  const second = storage.setItem("collection", "second selection");
  expect(storage.getItem("collection")).toBe("second selection");
  await Promise.all([first, second]);
  expect(writes).toEqual([{ collection: "first selection" }, { collection: "second selection" }]);
  expect(scopes.every((scope) => JSON.stringify(scope) === '{"scope":"project"}')).toBe(true);
  expect((await createTimelineStorage(host, (error) => errors.push(error))).getItem("collection")).toBe(
    "second selection",
  );
  expect(errors).toEqual([]);
});

test("Timeline reports a failed preference save and can save the next choice", async () => {
  const failure = new Error("Could not save preferences");
  let writes = 0;
  const host = {
    async call(method: string) {
      if (method === "preferences.get") return undefined;
      if (++writes === 1) throw failure;
      return { ok: true };
    },
  } as GuestHost;
  const errors: unknown[] = [];
  const storage = await createTimelineStorage(host, (error) => errors.push(error));
  await storage.setItem("collection", "first");
  await storage.setItem("collection", "second");
  expect(errors).toEqual([failure]);
  expect(writes).toBe(2);
});
