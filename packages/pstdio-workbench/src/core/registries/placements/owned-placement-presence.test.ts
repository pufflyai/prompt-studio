import { describe, expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

const view = (id: string) => ({ id, title: id, body: { kind: "react" as const, render: () => null } });

const setup = () => {
  const workbench = createWorkbench();
  for (const id of ["start", "other-start", "tools", "session"]) workbench.views.registerView(view(id));
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.modes.registerMode({ id: "other", activate: () => undefined });
  workbench.pages.registerPage({
    id: "start",
    ref: { extensionId: "pstdio", kind: "page", id: "start" },
    modeId: "project",
    path: "",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "start" }],
  });
  workbench.pages.registerPage({
    id: "other-start",
    ref: { extensionId: "pstdio", kind: "page", id: "other-start" },
    modeId: "other",
    path: "other",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "other-start" }],
  });
  workbench.pageLocations.setProject("project-1");
  const open = (pageId: string) => {
    const result = workbench.pageLocations.navigate({
      kind: "page",
      page: { extensionId: "pstdio", kind: "page", id: pageId },
    });
    if (!result.ok) throw new Error(result.diagnostic.message);
  };
  const sideWidgets = () => workbench.layout.getLayout().regions.side.widgets;
  return { workbench, open, sideWidgets };
};

describe("static placement presence", () => {
  test("shell placements seed fixed and open placements and keep closed ones hidden", () => {
    const { workbench } = setup();
    workbench.shellPlacements.registerPlacement({
      id: "fixed",
      item: { kind: "view", viewId: "tools", presence: "fixed" },
      region: "side",
    });
    workbench.shellPlacements.registerPlacement({
      id: "open",
      item: { kind: "view", viewId: "tools", presence: "open" },
      region: "side",
    });
    workbench.shellPlacements.registerPlacement({
      id: "closed",
      item: { kind: "view", viewId: "tools", presence: "closed" },
      region: "side",
    });

    const rendered = workbench.shellPlacements
      .resolvePlacements()
      .map((placement) => (placement.identity.kind === "shell" ? placement.identity.placementId : "other-owner"));

    expect(rendered.sort()).toEqual(["fixed", "open"]);
  });

  test("a fixed placement is not closable", () => {
    const { workbench } = setup();
    workbench.shellPlacements.registerPlacement({
      id: "fixed",
      item: { kind: "view", viewId: "tools", presence: "fixed" },
      region: "side",
    });

    expect(() =>
      workbench.shellPlacements.closePlacement({ kind: "shell", placementId: "fixed", instanceKey: "default" }),
    ).toThrow();
    const placement = workbench.shellPlacements.resolvePlacements()[0];
    expect(placement?.value.closable).toBe(false);
  });

  test("a closed optional placement stays closed when the user returns to its mode", () => {
    const { workbench, open, sideWidgets } = setup();
    workbench.modePlacements.registerPlacement({
      id: "project.tools",
      ref: { extensionId: "pstdio", kind: "placement", id: "tools" },
      modeId: "project",
      item: { kind: "view", viewId: "tools", presence: "open" },
      region: "side",
    });

    open("start");
    expect(sideWidgets()).toHaveLength(1);

    workbench.modePlacements.closePlacement({
      kind: "mode",
      modeId: "project",
      placementId: "project.tools",
      instanceKey: "default",
    });
    expect(sideWidgets()).toHaveLength(0);

    open("other-start");
    open("start");
    expect(sideWidgets()).toHaveLength(0);
  });

  test("an opened closed placement stays open when the user returns to its mode", () => {
    const { workbench, open, sideWidgets } = setup();
    workbench.modePlacements.registerPlacement({
      id: "project.tools",
      ref: { extensionId: "pstdio", kind: "placement", id: "tools" },
      modeId: "project",
      item: { kind: "view", viewId: "tools", presence: "closed" },
      region: "side",
    });

    open("start");
    expect(sideWidgets()).toHaveLength(0);

    workbench.modePlacements.openPlacement({ panel: { extensionId: "pstdio", kind: "placement", id: "tools" } });
    expect(sideWidgets()).toHaveLength(1);

    open("other-start");
    open("start");
    expect(sideWidgets()).toHaveLength(1);
  });
});

describe("resource placement cardinality", () => {
  const registerSessionPlacement = (workbench: ReturnType<typeof setup>["workbench"], cardinality: "one" | "many") => {
    workbench.modePlacements.registerPlacement({
      id: "project.session",
      ref: { extensionId: "pstdio", kind: "placement", id: "session" },
      modeId: "project",
      item: { kind: "resource", viewId: "session", resourceKinds: ["session"], cardinality },
      region: "side",
    });
  };

  test("cardinality one rebinds the single instance to the next resource", () => {
    const { workbench, open, sideWidgets } = setup();
    registerSessionPlacement(workbench, "one");
    open("start");

    workbench.modePlacements.openPlacement({
      panel: { extensionId: "pstdio", kind: "placement", id: "session" },
      resource: { kind: "session", uri: "pstdio://session/a", label: "A" },
    });
    workbench.modePlacements.openPlacement({
      panel: { extensionId: "pstdio", kind: "placement", id: "session" },
      resource: { kind: "session", uri: "pstdio://session/b", label: "B" },
    });

    expect(sideWidgets()).toHaveLength(1);
    expect(sideWidgets()[0]?.resourceUri).toBe("pstdio://session/b");
  });

  test("cardinality many keeps one instance per resource and reselects existing ones", () => {
    const { workbench, open, sideWidgets } = setup();
    registerSessionPlacement(workbench, "many");
    open("start");

    workbench.modePlacements.openPlacement({
      panel: { extensionId: "pstdio", kind: "placement", id: "session" },
      resource: { kind: "session", uri: "pstdio://session/a", label: "A" },
      open: "pin",
    });
    workbench.modePlacements.openPlacement({
      panel: { extensionId: "pstdio", kind: "placement", id: "session" },
      resource: { kind: "session", uri: "pstdio://session/b", label: "B" },
      open: "pin",
    });
    workbench.modePlacements.openPlacement({
      panel: { extensionId: "pstdio", kind: "placement", id: "session" },
      resource: { kind: "session", uri: "pstdio://session/a", label: "A" },
      open: "pin",
    });

    expect(sideWidgets().map((widget) => widget.resourceUri)).toEqual(["pstdio://session/a", "pstdio://session/b"]);
  });
});
