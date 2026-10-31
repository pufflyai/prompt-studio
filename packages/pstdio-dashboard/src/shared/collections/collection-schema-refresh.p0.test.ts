import { afterEach, expect, test } from "bun:test";
import { publishExtensionEvent, publishExtensionEventReset } from "@/shared/extensions/extension-webview-broadcast";
import { createSharedCollectionViews } from "./collection-views";
import { cleanup, setup } from "./collection-views.test-support";

afterEach(cleanup);

test("content changes skip saved-view reads while schema events and reset still clean filters", async () => {
  let reads = 0;
  setup(
    () => Response.json({}),
    () => {
      reads += 1;
      return [];
    },
  );
  const source = createSharedCollectionViews({
    projectId: "project",
    extensionInstanceId: null,
    localId: "table",
    record: { id: "table", refreshEventIds: ["tickets.changed"], schemaRefreshEventIds: ["schema.changed"] },
  });
  // Reads are HTTP requests, so wait for an expected read instead of a fixed time that load can outlast.
  const readsReach = async (count: number) => {
    for (let waited = 0; reads < count && waited < 2_000; waited += 5) await Bun.sleep(5);
    return reads;
  };
  const stop = source.subscribe(() => {});
  try {
    expect(await readsReach(1)).toBe(1);
    publishExtensionEvent({ projectId: "project", id: "tickets.changed" });
    await Bun.sleep(20);
    expect(reads).toBe(1);
    publishExtensionEvent({ projectId: "other", id: "schema.changed" });
    await Bun.sleep(20);
    expect(reads).toBe(1);
    publishExtensionEvent({ projectId: "project", id: "schema.changed" });
    expect(await readsReach(2)).toBe(2);
    publishExtensionEventReset({ projectId: "other" });
    await Bun.sleep(20);
    expect(reads).toBe(2);
    publishExtensionEventReset({ projectId: "project" });
    expect(await readsReach(3)).toBe(3);
  } finally {
    stop();
  }
});
