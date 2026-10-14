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
  const stop = source.subscribe(() => {});
  try {
    await Bun.sleep(20);
    expect(reads).toBe(1);
    publishExtensionEvent({ projectId: "project", id: "tickets.changed" });
    await Bun.sleep(20);
    expect(reads).toBe(1);
    publishExtensionEvent({ projectId: "other", id: "schema.changed" });
    await Bun.sleep(20);
    expect(reads).toBe(1);
    publishExtensionEvent({ projectId: "project", id: "schema.changed" });
    await Bun.sleep(20);
    expect(reads).toBe(2);
    publishExtensionEventReset();
    await Bun.sleep(20);
    expect(reads).toBe(3);
  } finally {
    stop();
  }
});
