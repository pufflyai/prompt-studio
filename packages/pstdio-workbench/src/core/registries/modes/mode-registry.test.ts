import { describe, expect, test } from "bun:test";
import { createWorkbenchPanelsController } from "../../controllers/panels/panels-controller";
import { createContextKeyService } from "../../shared/context/context-key-service";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createLayoutModel, type LayoutModel } from "../layout/layout-model";
import {
  createWorkbenchModeRegistry,
  type WorkbenchModeActivationContext,
  type WorkbenchModeContribution,
} from "./mode-registry";

const createContext = (layout: LayoutModel) =>
  ({
    context: createContextKeyService(),
    layout,
    panels: createWorkbenchPanelsController(),
  }) as unknown as WorkbenchModeActivationContext;

const trackingMode = (id: string, log: string[]): WorkbenchModeContribution => ({
  id,
  panels: ["main"],
  activate: () => {
    log.push(`activate:${id}`);
    return createDisposable(() => {
      log.push(`dispose:${id}`);
    });
  },
});

describe("createWorkbenchModeRegistry", () => {
  test("initializes each mode once and disposes it when unregistered", () => {
    const log: string[] = [];
    const layout = createLayoutModel();
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });

    const project = registry.registerMode(trackingMode("project", log));
    const settings = registry.registerMode(trackingMode("settings", log));

    registry.setActiveMode("project");
    registry.setActiveMode("settings");
    registry.setActiveMode("project");

    expect(log).toEqual(["activate:project", "activate:settings"]);

    project.dispose();
    settings.dispose();

    expect(log).toEqual(["activate:project", "activate:settings", "dispose:project", "dispose:settings"]);
  });

  test("notifies listeners on active mode change", () => {
    const log: string[] = [];
    const layout = createLayoutModel();
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    registry.registerMode({ id: "a", panels: ["main"], activate: () => undefined });

    registry.onDidChangeActive(() => log.push("change"));

    registry.setActiveMode("a");
    registry.setActiveMode("a"); // no-op
    registry.setActiveMode(undefined);

    expect(log).toEqual(["change", "change"]);
  });

  test("stops observing layout scope changes when disposed", () => {
    const layout = createLayoutModel();
    const subscribeToScopeChanges = layout.onDidChangePersistenceScope;
    let scopeSubscriptionDisposed = false;
    layout.onDidChangePersistenceScope = (listener) => {
      const subscription = subscribeToScopeChanges(listener);
      return createDisposable(() => {
        scopeSubscriptionDisposed = true;
        subscription.dispose();
      });
    };
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    let seeds = 0;
    registry.registerMode({
      id: "project",
      panels: ["main"],
      activate: () => undefined,
      seed: () => {
        seeds += 1;
      },
    });
    registry.setActiveMode("project");

    registry.dispose();
    layout.setPersistenceScope("project/one");

    expect(scopeSubscriptionDisposed).toBe(true);
    expect(seeds).toBe(1);
  });

  test("publishes active mode context keys", () => {
    const layout = createLayoutModel();
    const context = createContextKeyService();
    const panels = createWorkbenchPanelsController();
    const registry = createWorkbenchModeRegistry({
      resolveContext: () => ({ context, layout, panels }) as unknown as WorkbenchModeActivationContext,
    });

    registry.registerMode({ id: "project", panels: ["main"], activate: () => undefined });
    registry.setActiveMode("project");

    expect(context.matches("activeWorkbenchMode == project && workbenchMode.project")).toBe(true);

    registry.setActiveMode(undefined);

    expect(context.get("activeWorkbenchMode")).toBeUndefined();
    expect(context.get("workbenchMode.project")).toBeUndefined();
  });

  test("disposes the active mode when the registration is disposed", () => {
    const log: string[] = [];
    const layout = createLayoutModel();
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    const registration = registry.registerMode(trackingMode("temp", log));

    registry.setActiveMode("temp");
    registration.dispose();

    expect(log).toEqual(["activate:temp", "dispose:temp"]);
    expect(registry.getActiveModeId()).toBeUndefined();
  });

  test("activates with multiple disposables in reverse order", () => {
    const log: string[] = [];
    const layout = createLayoutModel();
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    const make = (id: string): Disposable => createDisposable(() => log.push(`dispose:${id}`));

    const registration = registry.registerMode({
      id: "multi",
      panels: ["main"],
      activate: () => [make("first"), make("second"), make("third")],
    });

    registry.setActiveMode("multi");
    registry.setActiveMode(undefined);

    expect(log).toEqual([]);
    registration.dispose();

    expect(log).toEqual(["dispose:third", "dispose:second", "dispose:first"]);
  });
});

describe("mode panel layouts", () => {
  test("preserves project chrome while removing panels unavailable in the next mode", () => {
    const layout = createLayoutModel();
    layout.registerWidget({
      id: "workbench.status",
      title: "Status",
      region: "status",
      rendererId: "workbench.status",
    });
    layout.registerWidget({ id: "sessions.tree", title: "Sessions", region: "sidenav", rendererId: "sessions.tree" });
    layout.registerWidget({ id: "sessions.chat", title: "Session", region: "main", rendererId: "sessions.chat" });
    layout.openWidget("workbench.status", { pinned: true });

    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });

    registry.registerMode({
      id: "sessions",
      panels: ["main", "secondary", "side"],
      activate: (ctx) => {
        return ctx.layout.registerWidget({
          id: "sessions.secondary",
          title: "Session details",
          region: "secondary",
          rendererId: "sessions.secondary",
        });
      },
      seed: (ctx) => {
        ctx.layout.openWidget("sessions.chat");
        ctx.layout.openWidget("sessions.secondary");
      },
    });
    registry.registerMode({
      id: "zen",
      panels: ["main"],
      activate: () => undefined,
    });

    layout.openWidget("sessions.tree", { pinned: true });
    registry.setActiveMode("sessions");

    expect(layout.getLayout().regions.sidenav.widgets).toHaveLength(1);
    expect(layout.getLayout().regions.main.widgets).toHaveLength(1);
    expect(layout.getLayout().regions.secondary.widgets).toHaveLength(1);

    registry.setActiveMode("zen");

    expect(layout.getLayout().regions.status.widgets).toHaveLength(1);
    expect(layout.getLayout().regions.sidenav.widgets).toHaveLength(1);
    expect(layout.getLayout().regions.main.widgets).toEqual([]);
    expect(layout.getLayout().regions.secondary.widgets).toEqual([]);
    expect(layout.getLayout().regions.secondary.visible).toBe(false);
    expect(layout.getLayout().activeWidgetId).toBeUndefined();
  });

  test("restores an unscoped mode layout without replaying its seed", () => {
    const layout = createLayoutModel();
    layout.registerWidget({ id: "sessions.chat", title: "Session", region: "main", rendererId: "sessions.chat" });
    layout.registerWidget({ id: "sessions.notes", title: "Notes", region: "main", rendererId: "sessions.notes" });

    let seeds = 0;
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    registry.registerMode({
      id: "sessions",
      panels: ["main"],
      activate: () => undefined,
      seed: (ctx) => {
        seeds += 1;
        ctx.layout.openWidget("sessions.chat");
      },
    });
    registry.registerMode({ id: "zen", panels: ["main"], activate: () => undefined });

    registry.setActiveMode("sessions");
    layout.openWidget("sessions.notes");

    registry.setActiveMode("zen");
    expect(layout.getLayout().regions.main.widgets).toEqual([]);

    registry.setActiveMode("sessions");
    expect(layout.getLayout().regions.main.widgets.map((placement) => placement.contributionId)).toEqual([
      "sessions.chat",
      "sessions.notes",
    ]);
    expect(seeds).toBe(1);
  });

  test("seeds a mode once for each external persistence scope", () => {
    const layouts = new Map<string | undefined, ReturnType<LayoutModel["getLayout"]>>();
    const layout = createLayoutModel({
      persistence: {
        getLayout: (scope) => layouts.get(scope),
        setLayout: (value, scope) => layouts.set(scope, structuredClone(value)),
      },
    });
    layout.registerWidget({ id: "workspace.editor", title: "Editor", region: "main", rendererId: "workspace.editor" });

    let seeds = 0;
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    registry.registerMode({
      id: "workspace",
      panels: ["main", "secondary", "side"],
      activate: () => undefined,
      seed: (ctx) => {
        seeds += 1;
        ctx.layout.openWidget("workspace.editor");
      },
    });

    layout.setPersistenceScope("project/p1/mode/workspace/resource/a");
    registry.setActiveMode("workspace");
    layout.setPersistenceScope("project/p1/mode/workspace/resource/b");
    layout.setPersistenceScope("project/p1/mode/workspace/resource/a");

    expect(seeds).toBe(2);
    expect(layout.getLayout().regions.main.widgets).toHaveLength(1);
  });

  test("establishes the seeded primary Panel as the mode Location", () => {
    const layout = createLayoutModel();
    layout.registerPanel({
      id: "review",
      title: "Review",
      region: "main",
      rendererId: "review",
      closable: false,
    });
    const established: string[] = [];
    const registry = createWorkbenchModeRegistry({
      establishLocation: (instanceId) => established.push(instanceId),
      resolveContext: () => createContext(layout),
    });
    registry.registerMode({
      id: "review",
      activate: () => undefined,
      seed: (ctx) => {
        ctx.layout.openPanel("review");
      },
    });

    registry.setActiveMode("review");

    expect(established).toEqual(["review"]);
  });

  test("establishes the mode Location before seeded supporting Panels open", () => {
    const layout = createLayoutModel();
    const resource = { kind: "review", uri: "pstdio://review/one" };
    layout.registerPanel({
      id: "review",
      title: "Review",
      region: "main",
      rendererId: "review",
      closable: false,
    });
    layout.registerPanel({
      id: "checks",
      title: "Checks",
      region: "secondary",
      rendererId: "checks",
      closable: true,
      eligibleLocations: { modeIds: ["review"] },
    });
    const registry = createWorkbenchModeRegistry({
      establishLocation: (instanceId) => {
        layout.establishLocation(instanceId);
      },
      resolveContext: () => createContext(layout),
    });
    registry.registerMode({
      id: "review",
      activate: () => undefined,
      seed: (ctx) => {
        ctx.layout.openPanel("review", { resource });
        ctx.layout.openPanel("checks");
      },
    });

    registry.setActiveMode("review");

    expect(layout.getLayout().regions.secondary.widgets).toEqual([
      expect.objectContaining({ contributionId: "checks", ownerResourceUri: resource.uri }),
    ]);
  });

  test("defers seeding until the caller establishes the persistence scope", () => {
    const layout = createLayoutModel();
    const seededScopes: (string | undefined)[] = [];
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    registry.registerMode({
      id: "workspace",
      panels: ["main"],
      activate: () => undefined,
      seed: (ctx) => seededScopes.push(ctx.layout.getPersistenceScope()),
    });

    layout.setPersistenceScope("project/p1/mode/project");
    registry.setActiveMode("workspace", { deferSeed: true });
    layout.setPersistenceScope("project/p1/mode/workspace");

    expect(seededScopes).toEqual([]);

    registry.seedActiveMode();

    expect(seededScopes).toEqual(["project/p1/mode/workspace"]);
  });

  test("enters on every switch and disposes active behavior on leave", () => {
    const log: string[] = [];
    const layout = createLayoutModel();
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    registry.registerMode({
      id: "project",
      panels: ["main"],
      activate: () => undefined,
      enter: () => {
        log.push("enter:project");
        return createDisposable(() => log.push("leave:project"));
      },
    });
    registry.registerMode({ id: "settings", panels: ["main"], activate: () => undefined });

    registry.setActiveMode("project");
    registry.setActiveMode("settings");
    registry.setActiveMode("project");

    expect(log).toEqual(["enter:project", "leave:project", "enter:project"]);
  });

  test("preserves Location-owned Sub Panels when switching modes", () => {
    const layout = createLayoutModel();
    layout.registerWidget({
      id: "sessions.chat",
      title: "Session",
      region: "side",
      rendererId: "sessions.chat",
      role: "sub-panel",
    });

    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    registry.registerMode({ id: "project", panels: ["main", "secondary", "side"], activate: () => undefined });
    registry.registerMode({ id: "sessions", panels: ["main", "secondary", "side"], activate: () => undefined });

    registry.setActiveMode("project");
    layout.openWidget("sessions.chat");
    registry.setActiveMode("sessions");

    expect(layout.getLayout().regions.side.widgets).toHaveLength(1);
  });
});
