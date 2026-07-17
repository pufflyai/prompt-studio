import { describe, expect, test } from "bun:test";
import { extensionViewRecordSchema } from "./views";

describe("extension view panel menus", () => {
  test("accepts a serializable host, side, icon, and optional size", () => {
    const result = extensionViewRecordSchema.parse({
      id: "planner.properties",
      extensionId: "pstdio-planner",
      slotId: "planner.properties",
      title: "Properties",
      controlsRendererId: "planner.properties",
      menu: {
        host: "planner.editor",
        side: "right",
        icon: "sliders-horizontal",
        sizePx: 120,
      },
    });

    expect(result.menu).toEqual({
      host: "planner.editor",
      side: "right",
      icon: "sliders-horizontal",
      sizePx: 120,
    });
  });
});
