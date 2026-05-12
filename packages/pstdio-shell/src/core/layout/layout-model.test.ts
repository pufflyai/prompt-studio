import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";

describe("createLayoutModel", () => {
  test("opens widgets in their contributed area and tracks active resource state", () => {
    const layout = createLayoutModel();

    layout.registerWidget({
      id: "sessions.chat",
      title: "Session",
      area: "right",
      fallbackArea: "main",
      resourceKinds: ["session"],
      renderer: "react",
      rendererId: "sessions.chat",
    });

    const placement = layout.openWidget("sessions.chat", {
      resource: { kind: "session", uri: "pstdio://session/s1", label: "Session 1" },
    });

    expect(placement).toMatchObject({
      widgetId: "sessions.chat",
      contributionId: "sessions.chat",
      resourceUri: "pstdio://session/s1",
      title: "Session 1",
    });
    expect(layout.getLayout().activeWidgetId).toBe("sessions.chat");
    expect(layout.getLayout().activeResourceUri).toBe("pstdio://session/s1");
    expect(layout.getLayout().areas.right.activeWidgetId).toBe("sessions.chat");
  });

  test("reuses singleton widget placements instead of adding duplicates", () => {
    const layout = createLayoutModel();

    layout.registerWidget({
      id: "diagnostics.center",
      title: "Diagnostics",
      area: "bottom",
      singleton: true,
      renderer: "react",
    });

    layout.openWidget("diagnostics.center");
    layout.openWidget("diagnostics.center");

    expect(layout.getLayout().areas.bottom.widgets).toHaveLength(1);
  });
});
