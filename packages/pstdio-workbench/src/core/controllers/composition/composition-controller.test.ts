import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../workbench-core";

describe("workbench composition query", () => {
  test("returns open, addable, and closable panels for one region", () => {
    const workbench = createWorkbenchCore();
    workbench.layout.registerPanel({
      id: "notes",
      title: "Notes",
      region: "main",
      rendererId: "notes",
      eligibleLocations: {},
    });
    workbench.layout.registerPanel({
      id: "artifacts",
      title: "Artifacts",
      region: "main",
      rendererId: "artifacts",
    });
    workbench.modes.registerMode({
      id: "lab",
      listAddablePanels: () => [{ panelId: "artifacts", region: "main", allowedRegions: ["main"] }],
      activate: () => undefined,
    });
    workbench.modes.setActiveMode("lab");

    expect(workbench.composition.panelsFor("main").addable.map((panel) => panel.panelId)).toEqual([
      "artifacts",
      "notes",
    ]);

    workbench.layout.openWidget("artifacts", { region: "main", role: "location", closable: true });
    const panels = workbench.composition.panelsFor("main");

    expect(panels.open.map((panel) => panel.contributionId)).toEqual(["artifacts"]);
    expect(panels.addable.map((panel) => panel.panelId)).toEqual(["notes"]);
    expect(panels.closable).toEqual(["artifacts"]);
  });

  test("offers registered panels that match the active location resource", () => {
    const workbench = createWorkbenchCore();
    const resource = { kind: "ticket", uri: "pstdio://ticket/PS-281", id: "PS-281" };
    workbench.layout.registerPanel({
      id: "ticket",
      title: "Ticket",
      region: "main",
      rendererId: "ticket",
    });
    workbench.layout.registerPanel({
      id: "session",
      title: "Session",
      region: "side",
      rendererId: "session",
      eligibleLocations: { resourceKinds: ["ticket"] },
    });

    workbench.layout.openWidget("ticket", { region: "main", resource, role: "location" });

    expect(workbench.composition.panelsFor("side").addable.map((panel) => panel.panelId)).toEqual(["session"]);
  });

  test("offers registered panels that match the active view location", async () => {
    const workbench = createWorkbenchCore();
    workbench.layout.registerPanel({ id: "start", title: "Start", region: "main", rendererId: "start" });
    workbench.views.registerView({ id: "start", panelId: "start", title: "Start" });
    workbench.layout.registerPanel({
      id: "session",
      title: "Session",
      region: "side",
      rendererId: "session",
      eligibleLocations: { canOpenLocation: ({ viewId }) => viewId === "start" },
    });

    await workbench.views.openView("start");

    expect(workbench.composition.panelsFor("side").addable.map((panel) => panel.panelId)).toEqual(["session"]);
  });

  test("does not offer panels in a region excluded by the active mode", () => {
    const workbench = createWorkbenchCore();
    workbench.layout.registerPanel({
      id: "terminal",
      title: "Terminal",
      region: "secondary",
      rendererId: "terminal",
      eligibleLocations: {},
    });
    workbench.modes.registerMode({ id: "lab", panels: ["main", "side"], activate: () => undefined });
    workbench.modes.setActiveMode("lab");

    expect(workbench.composition.panelsFor("secondary")).toEqual({ open: [], addable: [], closable: [] });
  });

  test("does not offer a singleton Location that is already open for the active resource", () => {
    const workbench = createWorkbenchCore();
    const resource = { kind: "ticket", uri: "pstdio://ticket/PS-281", id: "PS-281" };
    workbench.layout.registerPanel({
      id: "ticket",
      title: "Ticket",
      region: "main",
      rendererId: "ticket",
      singleton: true,
      eligibleLocations: { resourceKinds: ["ticket"] },
    });

    workbench.layout.openWidget("ticket", { region: "main", resource, role: "location" });

    expect(workbench.composition.panelsFor("main").addable).toEqual([]);
  });
});
