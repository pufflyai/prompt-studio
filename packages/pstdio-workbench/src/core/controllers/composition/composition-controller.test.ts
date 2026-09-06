import { describe, expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

describe("workbench composition query", () => {
  test("returns open, addable, and closable panels for one region", () => {
    const workbench = createWorkbench();
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
    const workbench = createWorkbench();
    const resource = {
      type: "ticket",
      id: "PS-281",
    };

    workbench.layout.registerPanel({
      id: "session",
      title: "Session",
      region: "side",
      rendererId: "session",
      eligibleLocations: { resourceKinds: ["ticket"] },
    });
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.views.registerView({ id: "ticket", title: "Ticket", body: { kind: "react", render: () => null } });
    const page = { kind: "page" as const, id: "ticket", extensionId: "test" };
    workbench.pages.registerPage({
      id: "ticket",
      ref: page,
      path: "ticket",
      modeId: "project",
      resource: { kinds: [{ kind: "resource-kind", id: "ticket" }] },
      main: { kind: "panels", empty: { kind: "view", id: "ticket" } },
      slots: [],
    });
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({ kind: "page", page, resource });
    expect(workbench.composition.panelsFor("side").addable.map((panel) => panel.panelId)).toEqual(["session"]);
  });
  test("offers registered panels that match the active page view", () => {
    const workbench = createWorkbench();
    const startPage = { extensionId: "pstdio", kind: "page" as const, id: "start" };
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.views.registerView({
      id: "start",
      title: "Start",
      body: { kind: "react", render: () => null },
    });
    workbench.pages.registerPage({
      id: "start",
      ref: startPage,
      title: "Start",
      path: "",
      modeId: "project",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "start",
        },
        cardinality: "one",
      },
      slots: [],
    });
    workbench.layout.registerPanel({
      id: "session",
      title: "Session",
      region: "side",
      rendererId: "session",
      eligibleLocations: { canOpenLocation: ({ viewId }) => viewId === "start" },
    });
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({ kind: "page", page: startPage });
    expect(workbench.composition.panelsFor("side").addable.map((panel) => panel.panelId)).toEqual(["session"]);
  });
  test("does not offer panels in a region excluded by the active mode", () => {
    const workbench = createWorkbench();
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
    const workbench = createWorkbench();
    const resource = {
      type: "ticket",
      id: "PS-281",
    };
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
  test("runs a resource binding's add action through the navigation executor", () => {
    const workbench = createWorkbench();
    let received: unknown;
    let source: string | undefined;
    workbench.commands.registerCommand(
      { id: "create-session", label: "Create session" },
      {
        execute: (args, context) => {
          received = args;
          source = context?.source;
        },
      },
    );
    workbench.views.registerView({
      id: "session",
      title: "Session",
      body: { kind: "react", render: () => null },
    });
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.modePlacements.registerPlacement({
      id: "project.session",
      ref: { extensionId: "pstdio", kind: "placement", id: "session" },
      modeId: "project",
      item: {
        kind: "binding",
        binding: {
          kinds: [
            {
              kind: "resource-kind",
              id: "session",
            },
          ],
          view: {
            kind: "view",
            id: "session",
          },
          cardinality: "many",
          add: {
            kind: "command",
            target: { command: { kind: "command", id: "create-session" }, params: { origin: "panel-add" } },
          },
        },
      },
      region: "side",
    });
    workbench.modes.setActiveMode("project");
    workbench.composition.panelsFor("side").addable[0]?.open?.();
    expect(received).toEqual({ origin: "panel-add" });
    expect(source).toBe("panel-add");
  });
});
