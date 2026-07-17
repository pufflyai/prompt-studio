import { describe, expect, test } from "bun:test";
import { createLayoutPersister } from "./layout-persister";
import { createDefaultWorkbenchLayout } from "./layout-types";

describe("createLayoutPersister", () => {
  test("coalesces trailing writes and flushes the latest layout immediately", async () => {
    const writes: number[] = [];
    const persister = createLayoutPersister(
      {
        getLayout: () => undefined,
        setLayout: (layout) => writes.push(layout.nodes.left?.size ?? 0),
      },
      10,
    );
    const first = createDefaultWorkbenchLayout();
    const second = createDefaultWorkbenchLayout();
    first.nodes.left = { size: 200 };
    second.nodes.left = { size: 320 };

    persister.schedule(first, [{ mode: "workspace" }]);
    persister.schedule(second, [{ mode: "workspace" }]);

    expect(writes).toEqual([]);
    persister.flush();
    expect(writes).toEqual([320]);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(writes).toEqual([320]);
  });
});
