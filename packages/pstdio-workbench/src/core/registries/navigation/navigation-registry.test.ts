import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../workbench-core";
import { createNavigationRegistry, type NavigationDispatcherContext } from "./navigation-registry";

const createDispatcherCollector = () => {
  const calls: Array<{ kind: string; payload: unknown }> = [];
  const dispatcher: NavigationDispatcherContext = {
    openPage: async (pageId, input) => {
      calls.push({ kind: "openPage", payload: { pageId, input } });
      return pageId;
    },
    executeCommand: async (commandId, args) => {
      calls.push({ kind: "executeCommand", payload: { commandId, args } });
      return commandId;
    },
  };
  return { dispatcher, calls };
};

describe("createNavigationRegistry", () => {
  test("resolves deep links into a page target and dispatches page opens", async () => {
    const { dispatcher, calls } = createDispatcherCollector();
    const navigation = createNavigationRegistry({ resolveDispatcher: () => dispatcher });

    navigation.registerParser(
      {
        id: "project-uri",
        priority: 20,
        canParse: (location) => location.startsWith("pstdio://project/"),
        parse: (location) => ({
          kind: "page",
          pageId: "workspaces",
          resource: {
            kind: "project",
            uri: location,
            id: location.replace("pstdio://project/", ""),
            label: "Project",
          },
        }),
      },
      { source: "module", ownerId: "dashboard.project" },
    );

    const target = navigation.resolveLocation("pstdio://project/project-1");
    expect(target).toMatchObject({
      kind: "page",
      pageId: "workspaces",
      resource: { kind: "project", uri: "pstdio://project/project-1", id: "project-1" },
    });
    expect(navigation.listParsers()[0]?.ownerId).toBe("dashboard.project");

    const results = await navigation.navigate("pstdio://project/project-1");
    expect(results).toHaveLength(1);
    expect(calls).toEqual([
      {
        kind: "openPage",
        payload: {
          pageId: "workspaces",
          input: {
            resource: {
              kind: "project",
              uri: "pstdio://project/project-1",
              id: "project-1",
              label: "Project",
            },
          },
        },
      },
    ]);
  });

  test("dispatches compound targets sequentially in order", async () => {
    const { dispatcher, calls } = createDispatcherCollector();
    const navigation = createNavigationRegistry({ resolveDispatcher: () => dispatcher });

    navigation.registerParser({
      id: "compound-parser",
      canParse: (location) => location.startsWith("pstdio://open"),
      parse: () => ({
        kind: "compound",
        targets: [
          { kind: "command", commandId: "workbench.action.switchMode", args: { modeId: "ops" } },
          { kind: "page", pageId: "services" },
        ],
      }),
    });

    await navigation.navigate("pstdio://open?mode=ops&page=services");

    expect(calls.map((entry) => entry.kind)).toEqual(["executeCommand", "openPage"]);
  });

  test("compound dispatch validates every item before committing any item", async () => {
    const calls: string[] = [];
    const dispatcher: NavigationDispatcherContext = {
      canOpenPage: () => false,
      openPage: async (pageId) => {
        calls.push(`page:${pageId}`);
      },
      executeCommand: async () => {
        calls.push("command");
      },
    };
    const navigation = createNavigationRegistry({ resolveDispatcher: () => dispatcher });

    await expect(
      navigation.openTarget({
        kind: "compound",
        targets: [
          { kind: "command", commandId: "noop" },
          { kind: "page", pageId: "broken" },
        ],
      }),
    ).rejects.toThrow("Cannot open navigation page target: broken");
    expect(calls).toEqual([]);
  });

  test("compound dispatch rolls back earlier commits when a later item throws", async () => {
    const calls: string[] = [];
    const navigation = createNavigationRegistry({
      resolveDispatcher: () => ({
        createCheckpoint: () => {
          const checkpoint = [...calls];
          return () => {
            calls.splice(0, calls.length, ...checkpoint);
          };
        },
        openPage: async () => {
          calls.push("page");
          throw new Error("page dispatch failed");
        },
        executeCommand: async () => {
          calls.push("command");
        },
      }),
    });

    await expect(
      navigation.openTarget({
        kind: "compound",
        targets: [
          { kind: "command", commandId: "noop" },
          { kind: "page", pageId: "broken" },
        ],
      }),
    ).rejects.toThrow("page dispatch failed");
    expect(calls).toEqual([]);
  });

  test("dispatches command targets with args", async () => {
    const { dispatcher, calls } = createDispatcherCollector();
    const navigation = createNavigationRegistry({ resolveDispatcher: () => dispatcher });

    await navigation.openTarget({ kind: "command", commandId: "workbench.focusMain", args: ["main", 1] });

    expect(calls).toEqual([
      { kind: "executeCommand", payload: { commandId: "workbench.focusMain", args: ["main", 1] } },
    ]);
  });

  test("dispatches command targets through the real core with a single payload", async () => {
    const workbench = createWorkbenchCore();
    const payloads: unknown[] = [];
    workbench.commands.registerCommand(
      { id: "test.command", label: "Test command" },
      { execute: (args) => payloads.push(args) },
    );

    await workbench.navigation.openTarget({ kind: "command", commandId: "test.command", args: ["a", "b"] });

    expect(payloads).toEqual([["a", "b"]]);
  });

  test("resolves registered page paths and activates the page through the real core", async () => {
    const workbench = createWorkbenchCore();
    workbench.layout.registerLocation({
      id: "tickets.panel",
      title: "Tickets",
      region: "main",
      rendererId: "noop",
    });
    workbench.pages.registry.registerPage({
      id: "pstdio.pstdio-planner.page.tickets",
      title: "Tickets",
      extensionId: "pstdio.pstdio-planner",
      urlPath: "pstdio.pstdio-planner/tickets",
      slots: [{ id: "board", region: "main", panelId: "tickets.panel", closable: false }],
    });

    expect(workbench.navigation.resolveLocation("pstdio.pstdio-planner/tickets")).toEqual({
      kind: "page",
      pageId: "pstdio.pstdio-planner.page.tickets",
    });
    await workbench.navigation.navigate("pstdio.pstdio-planner/tickets");
    expect(workbench.layout.getLayout().regions.main.activeWidgetId).toBe("tickets.panel");
  });

  test("parses the resource segments after a page path into the page's resource argument", async () => {
    const workbench = createWorkbenchCore();
    workbench.pages.registry.registerPage({
      id: "pstdio.lab.page.blend",
      title: "Blend",
      extensionId: "pstdio.lab",
      urlPath: "pstdio.lab/blend",
      slots: [{ id: "scene", region: "main", cardinality: "one" }],
      bindings: [{ kind: "blend-project", panelId: "pstdio.lab.view.overview", slot: "scene" }],
    });

    expect(workbench.navigation.resolveLocation("pstdio.lab/blend/blend-project/p-1")).toEqual({
      kind: "page",
      pageId: "pstdio.lab.page.blend",
      resource: {
        kind: "blend-project",
        id: "p-1",
        uri: "pstdio://extension-resource/blend-project/p-1",
      },
    });
  });

  test("throws when no parser handles the location and when no dispatcher is configured", async () => {
    const navigation = createNavigationRegistry();

    expect(() => navigation.resolveLocation("pstdio://missing/1")).toThrow(
      "No navigation parser registered for location: pstdio://missing/1",
    );
    await expect(navigation.openTarget({ kind: "page", pageId: "workspaces" })).rejects.toThrow(
      "no dispatcher available",
    );
  });

  test("navigateResource still works for explicit ResourceRef navigation", async () => {
    const navigation = createNavigationRegistry();
    const visited: string[] = [];
    navigation.registerNavigator({
      id: "dashboard-router",
      canNavigate: (resource) => resource.kind === "project",
      createHref: (resource) => `/projects/${resource.id}/settings`,
      navigate: (resource) => {
        const href = `/projects/${resource.id}/settings`;
        visited.push(href);
        return href;
      },
    });

    await expect(
      navigation.navigateResource({
        kind: "project",
        uri: "pstdio://project/1",
        id: "1",
      }),
    ).resolves.toBe("/projects/1/settings");
    expect(visited).toEqual(["/projects/1/settings"]);
  });
});
