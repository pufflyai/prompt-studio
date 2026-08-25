import { describe, expect, test } from "bun:test";
import type { OpenWorkbenchPanelInput, WorkbenchPanelInstance } from "../layout/layout-types";
import { createViewRegistry } from "./view-registry";

const createPanelHost = () => {
  const panels = new Set(["tickets.panel", "font-editor.panel"]);
  const calls: Array<{ panelId: string; input: OpenWorkbenchPanelInput }> = [];

  return {
    calls,
    getPanel: (panelId: string) => (panels.has(panelId) ? { id: panelId } : undefined),
    openPanel: (panelId: string, input: OpenWorkbenchPanelInput = {}): WorkbenchPanelInstance => {
      calls.push({ panelId, input });
      return {
        instanceId: `${panelId}:1`,
        panelId,
        viewId: input.viewId ?? undefined,
        resource: input.resource ?? undefined,
        resourceUri: input.resource?.uri,
        title: input.title,
        closable: true,
      };
    },
  };
};

describe("createViewRegistry", () => {
  test("registers ordered source-neutral views and disposes them by stable ID", () => {
    const host = createPanelHost();
    const views = createViewRegistry(host);
    const tickets = views.registerView(
      { id: "pstdio-planner.tickets", panelId: "tickets.panel", title: "Tickets", path: "/tickets" },
      { ownerId: "pstdio-planner", source: "extension", priority: 10 },
    );
    views.registerView(
      { id: "font-editor", panelId: "font-editor.panel", title: "Font Editor", path: "/font-editor" },
      { ownerId: "dashboard.font-editor", source: "module" },
    );

    expect(views.listViews().map((view) => view.id)).toEqual(["pstdio-planner.tickets", "font-editor"]);
    expect(views.getView("pstdio-planner.tickets")).toMatchObject({
      panelId: "tickets.panel",
      ownerId: "pstdio-planner",
      source: "extension",
    });

    tickets.dispose();
    expect(views.getView("pstdio-planner.tickets")).toBeUndefined();
  });

  test("opens the backing panel with the stable view identity and a real resource binding", async () => {
    const host = createPanelHost();
    const views = createViewRegistry(host);
    const resource = { kind: "ticket", uri: "ticket://PS-298", id: "PS-298", label: "PS-298" };
    views.registerView({ id: "pstdio-planner.tickets", panelId: "tickets.panel", title: "Tickets" });

    const instance = await views.openView("pstdio-planner.tickets", {
      resource,
      strategy: { kind: "preview" },
    });

    expect(instance).toMatchObject({ viewId: "pstdio-planner.tickets", panelId: "tickets.panel", resource });
    expect(host.calls).toEqual([
      {
        panelId: "tickets.panel",
        input: {
          resource,
          strategy: { kind: "preview" },
          title: "Tickets",
          viewId: "pstdio-planner.tickets",
        },
      },
    ]);
  });

  test("opens an unbound view with an explicit empty resource binding", async () => {
    const host = createPanelHost();
    const views = createViewRegistry(host);
    views.registerView({ id: "pstdio-planner.tickets", panelId: "tickets.panel", title: "Tickets" });

    await views.openView("pstdio-planner.tickets");

    expect(host.calls[0]?.input).toMatchObject({
      resource: null,
      title: "Tickets",
      viewId: "pstdio-planner.tickets",
    });
  });

  test("resolves bounded identity aliases and paths without writing the alias as identity", async () => {
    const host = createPanelHost();
    const views = createViewRegistry(host);
    views.registerView({
      id: "pstdio-planner.tickets",
      panelId: "tickets.panel",
      path: "/tickets",
      aliases: ["dashboard-workbench.extension-view.pstdio-planner.tickets"],
      pathAliases: ["/legacy-tickets"],
    });

    expect(views.resolveViewId("dashboard-workbench.extension-view.pstdio-planner.tickets")).toBe(
      "pstdio-planner.tickets",
    );
    expect(views.resolvePath("/legacy-tickets")).toEqual({ kind: "view", viewId: "pstdio-planner.tickets" });

    await views.openView("dashboard-workbench.extension-view.pstdio-planner.tickets");
    expect(host.calls[0]?.input.viewId).toBe("pstdio-planner.tickets");
  });

  test("rejects duplicate identities, paths, aliases, and missing backing panels", () => {
    const host = createPanelHost();
    const views = createViewRegistry(host);
    views.registerView({
      id: "pstdio-planner.tickets",
      panelId: "tickets.panel",
      path: "/tickets",
      aliases: ["legacy-tickets"],
    });

    expect(() => views.registerView({ id: "pstdio-planner.tickets", panelId: "tickets.panel" })).toThrow(
      "View already registered: pstdio-planner.tickets",
    );
    expect(() => views.registerView({ id: "other", panelId: "font-editor.panel", path: "/tickets" })).toThrow(
      "View path already registered: /tickets",
    );
    expect(() =>
      views.registerView({ id: "other", panelId: "font-editor.panel", aliases: ["legacy-tickets"] }),
    ).toThrow("View alias already registered: legacy-tickets");
    expect(() => views.registerView({ id: "missing", panelId: "missing.panel" })).toThrow(
      "View backing panel is not registered: missing.panel",
    );
  });

  test("reports whether a registered view is ready to restore", () => {
    const host = createPanelHost();
    let ready = false;
    const views = createViewRegistry(host);
    views.registerView({
      id: "pstdio-planner.tickets",
      panelId: "tickets.panel",
      canResolve: () => ready,
    });

    expect(views.canResolveView("pstdio-planner.tickets")).toBe(false);
    ready = true;
    expect(views.canResolveView("pstdio-planner.tickets")).toBe(true);
    expect(views.canResolveView("missing")).toBe(false);
  });
});
