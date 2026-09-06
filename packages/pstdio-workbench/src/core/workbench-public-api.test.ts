import { describe, expect, test } from "bun:test";
import * as workbenchApi from "../index";
import { getWorkbenchPageRegistryInternals } from "./registries/pages/page-registry-internals";
import { createWorkbench } from "./workbench-core";

describe("Workbench public API", () => {
  test("keeps renderer registries behind the workbench host boundary", () => {
    const workbench = createWorkbench();
    expect("renderers" in workbench).toBe(false);
    expect("createWorkbenchRendererRegistry" in workbenchApi).toBe(false);
    expect("createTreeRendererRegistry" in workbenchApi).toBe(false);
  });
  test("views define content while page placements create visible instances", () => {
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.views.registerView({
      id: "ticket",
      title: "Ticket",
      body: { kind: "react", render: () => null },
    });
    workbench.views.registerView({
      id: "diff",
      title: "Diff",
      body: { kind: "react", render: () => null },
    });
    expect(workbench.layout.listPanelInstances()).toEqual([]);
    workbench.pages.registerPage({
      id: "ticket-page",
      ref: { extensionId: "pstdio.test", kind: "page", id: "ticket" },
      title: "Ticket",
      path: "ticket",
      modeId: "project",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "ticket",
        },
        cardinality: "one",
      },
      slots: [
        {
          id: "diff",
          region: "secondary",
          item: {
            kind: "view",
            view: {
              kind: "view",
              id: "diff",
            },
            presence: "open",
          },
        },
      ],
    });
    getWorkbenchPageRegistryInternals(workbench.pages).activateLocation({
      pageId: "ticket-page",
      projectId: "project-1",
      location: { page: { extensionId: "pstdio.test", kind: "page", id: "ticket" } },
      action: "testOpenTicket",
    });
    expect(workbench.layout.getActivePanel("main")).toMatchObject({ viewId: "ticket", closable: false });
    expect(workbench.layout.getActivePanel("secondary")).toMatchObject({ viewId: "diff", closable: true });
    expect(workbench.layout.listPanelInstances("secondary")).toHaveLength(1);
  });
  test("changes shell presentation through one canonical authority", () => {
    const workbench = createWorkbench({ defaultPanelOpenByRegionId: { secondary: true } });
    let changes = 0;
    const listener = workbench.shell.onDidChange(() => {
      changes += 1;
    });
    workbench.shell.setRegionOpen("secondary", false);
    workbench.shell.setRegionSize("secondary", 420);
    workbench.shell.setSidePanelPresentation("attached");
    expect(workbench.shell.getRegionState("secondary")).toEqual({ open: false, size: 420 });
    expect(workbench.layout.getLayout().regions.secondary.visible).toBe(false);
    expect(workbench.shell.getSidePanelPresentation()).toBe("attached");
    expect(changes).toBe(3);
    listener.dispose();
  });
  test("changes scoped layout state through the host boundary", () => {
    const layouts = new Map<
      string | undefined,
      ReturnType<typeof createWorkbench>["layout"] extends {
        getLayout(): infer T;
      }
        ? T
        : never
    >();
    const workbench = createWorkbench({
      layoutPersistence: {
        getLayout: (scope) => layouts.get(scope),
        setLayout: (layout, scope) => layouts.set(scope, layout),
      },
    });
    workbench.host.setPersistenceScope("resource:a");
    workbench.shell.setRegionSize("sidenav", 280);
    workbench.shell.setRegionSize("secondary", 360);
    workbench.host.setPersistenceScope("resource:b", { carryRegions: ["sidenav"] });
    workbench.shell.setRegionSize("secondary", 480);
    workbench.host.setPersistenceScope("resource:a", { carryRegions: ["sidenav"] });
    expect(workbench.host.getPersistenceScope()).toBe("resource:a");
    expect(workbench.shell.getRegionState("sidenav").size).toBe(280);
    expect(workbench.shell.getRegionState("secondary").size).toBe(360);
  });
});
