import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../workbench-core";
import { createNavigationRegistry, type NavigationDispatcherContext } from "./navigation-registry";

const createDispatcherCollector = () => {
  const calls: Array<{ kind: string; payload: unknown }> = [];
  const dispatcher: NavigationDispatcherContext = {
    openResource: async (resource, input) => {
      calls.push({ kind: "openResource", payload: { resource, input } });
      return resource;
    },
    openPanel: (panelId, input) => {
      calls.push({ kind: "openPanel", payload: { panelId, input } });
      return panelId;
    },
    executeCommand: async (commandId, args) => {
      calls.push({ kind: "executeCommand", payload: { commandId, args } });
      return commandId;
    },
  };
  return { dispatcher, calls };
};

describe("createNavigationRegistry", () => {
  test("resolves deep links into a NavigationTarget and dispatches resource opens", async () => {
    const { dispatcher, calls } = createDispatcherCollector();
    const navigation = createNavigationRegistry({ resolveDispatcher: () => dispatcher });

    navigation.registerParser(
      {
        id: "project-uri",
        priority: 20,
        canParse: (location) => location.startsWith("pstdio://project/"),
        parse: (location) => ({
          kind: "resource",
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
    navigation.registerNavigator({
      id: "dashboard-router",
      priority: 10,
      canNavigate: (resource) => resource.kind === "project",
      createHref: (resource) => `/projects/${resource.id}/settings`,
      navigate: (resource) => `/projects/${resource.id}/settings`,
    });

    const target = navigation.resolveLocation("pstdio://project/project-1");
    expect(target).toMatchObject({
      kind: "resource",
      resource: { kind: "project", uri: "pstdio://project/project-1", id: "project-1" },
    });
    expect(navigation.listParsers()[0]?.ownerId).toBe("dashboard.project");

    const results = await navigation.navigate("pstdio://project/project-1");
    expect(results).toHaveLength(1);
    expect(calls).toEqual([
      {
        kind: "openResource",
        payload: {
          resource: {
            kind: "project",
            uri: "pstdio://project/project-1",
            id: "project-1",
            label: "Project",
          },
          input: undefined,
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
          { kind: "resource", resource: { kind: "ticket", uri: "ticket://PS-200", id: "PS-200" } },
          { kind: "panel", panelId: "workspace-tree" },
        ],
      }),
    });

    await navigation.navigate("pstdio://open?resource=ticket:PS-200&view=workspace-tree");

    expect(calls.map((entry) => entry.kind)).toEqual(["openResource", "openPanel"]);
  });

  test("compound dispatch validates every item before committing any item", async () => {
    const calls: string[] = [];
    const dispatcher: NavigationDispatcherContext = {
      canOpenPanel: () => false,
      openResource: async (resource) => {
        calls.push(`resource:${resource.uri}`);
      },
      openPanel: () => {
        calls.push("widget");
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
          { kind: "resource", resource: { kind: "ticket", uri: "ticket://a" } },
          { kind: "panel", panelId: "broken" },
          { kind: "command", commandId: "noop" },
        ],
      }),
    ).rejects.toThrow("Cannot open navigation Panel target: broken");
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
        openResource: async (resource) => {
          calls.push(`resource:${resource.uri}`);
        },
        openPanel: () => {
          calls.push("widget");
          throw new Error("widget dispatch failed");
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
          { kind: "resource", resource: { kind: "ticket", uri: "ticket://a" } },
          { kind: "panel", panelId: "broken" },
        ],
      }),
    ).rejects.toThrow("widget dispatch failed");
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

  test("throws when no parser handles the location and when no dispatcher is configured", async () => {
    const navigation = createNavigationRegistry();

    expect(() => navigation.resolveLocation("pstdio://missing/1")).toThrow(
      "No navigation parser registered for location: pstdio://missing/1",
    );
    await expect(
      navigation.openTarget({ kind: "resource", resource: { kind: "project", uri: "pstdio://project/1" } }),
    ).rejects.toThrow("no dispatcher available");
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
