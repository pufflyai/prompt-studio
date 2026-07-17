import { describe, expect, test } from "bun:test";
import { classicFrame } from "./classic-frame";
import { createLayoutModel } from "./layout-model";
import { registerTestWidget } from "./layout-model-test-utils";
import { listOpenablePanels } from "./openable-panels";

describe("listOpenablePanels", () => {
  test("filters explicit panel opt-ins by slot and primary resource kind", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, {
      id: "workspace.output",
      title: "Workspace output",
      area: "secondary",
      openable: true,
      resourceKinds: ["workspace"],
    });
    registerTestWidget(layout, {
      id: "resource-agnostic.output",
      title: "Resource-agnostic output",
      area: "secondary",
      openable: true,
    });
    registerTestWidget(layout, {
      id: "ticket.output",
      title: "Ticket output",
      area: "secondary",
      openable: true,
      resourceKinds: ["ticket"],
    });
    registerTestWidget(layout, {
      id: "internal.output",
      title: "Internal output",
      area: "secondary",
    });
    registerTestWidget(layout, {
      id: "floating.output",
      title: "Floating output",
      area: "side",
      openable: true,
    });

    expect(
      listOpenablePanels({
        widgets: layout.listWidgets(),
        frame: classicFrame,
        slot: "secondary",
        primary: { kind: "workspace", uri: "pstdio://workspace/1" },
        layout: layout.getLayout(),
      }).map((widget) => widget.id),
    ).toEqual(["workspace.output", "resource-agnostic.output"]);
  });

  test("only panel-role non-primary slots accept openable panels", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, {
      id: "primary.panel",
      title: "Primary panel",
      area: "main",
      openable: true,
    });
    registerTestWidget(layout, {
      id: "side.panel",
      title: "Side panel",
      area: "side",
      openable: true,
    });

    expect(
      listOpenablePanels({
        widgets: layout.listWidgets(),
        frame: classicFrame,
        slot: "main",
        layout: layout.getLayout(),
      }),
    ).toEqual([]);
    expect(
      listOpenablePanels({
        widgets: layout.listWidgets(),
        frame: classicFrame,
        slot: "side",
        layout: layout.getLayout(),
      }),
    ).toMatchObject([{ id: "side.panel" }]);
    expect(
      listOpenablePanels({
        widgets: layout.listWidgets(),
        frame: classicFrame,
        slot: "missing",
        layout: layout.getLayout(),
      }),
    ).toEqual([]);
  });

  test("hides placed singletons but keeps repeatable panels openable", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, {
      id: "singleton.panel",
      title: "Singleton panel",
      area: "secondary",
      openable: true,
    });
    registerTestWidget(layout, {
      id: "repeatable.panel",
      title: "Repeatable panel",
      area: "secondary",
      openable: true,
      singleton: false,
    });
    layout.openWidget("singleton.panel");
    layout.openWidget("repeatable.panel");

    expect(
      listOpenablePanels({
        widgets: layout.listWidgets(),
        frame: classicFrame,
        slot: "secondary",
        layout: layout.getLayout(),
      }).map((widget) => widget.id),
    ).toEqual(["repeatable.panel"]);
  });
});
