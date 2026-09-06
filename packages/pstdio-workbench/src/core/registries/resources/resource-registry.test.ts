import { describe, expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { createResourceRegistry, type ResourceHierarchyCycle } from "./resource-registry";

describe("createResourceRegistry scoped candidates", () => {
  test("passes the active primary resource to providers so candidates can be scoped", () => {
    const workspaceA = {
      type: "workspace",
      id: "pstdio://workspace/a",
    };
    let primary = workspaceA;
    const resources = createResourceRegistry({ getPrimary: () => primary });
    resources.registerProvider({
      id: "sessions",
      kind: "session",
      // Only list sessions belonging to the primary workspace.
      list: (_query, context) =>
        resourceKey(context.primary) === resourceKey(workspaceA)
          ? [
              {
                resource: {
                  type: "session",
                  id: "pstdio://session/a1",
                },
              },
            ]
          : [],
    });
    expect(resources.listResources("").map((entry) => entry.resource.id)).toEqual(["pstdio://session/a1"]);
    primary = {
      type: "workspace",
      id: "pstdio://workspace/b",
    };
    expect(resources.listResources("")).toEqual([]);
  });
});
describe("createResourceRegistry hierarchy", () => {
  test("uses an explicit view as the terminal root without fabricating a resource", () => {
    const resources = createResourceRegistry({
      resolveView: (viewId) =>
        viewId === "pstdio-planner.tickets" ? { label: "Tickets", icon: "square-kanban" } : undefined,
    });
    const parent = {
      type: "ticket",
      label: "PS-1 Parent",
      id: "pstdio://ticket/parent",
    };
    const child = {
      type: "ticket",
      label: "PS-2 Child",
      id: "pstdio://ticket/child",
    };
    resources.registerHierarchyProvider({
      id: "tickets",
      canResolve: (resource) => resource.type === "ticket",
      getParent: (resource) =>
        resourceKey(resource) === resourceKey(parent) ? { type: "view", viewId: "pstdio-planner.tickets" } : parent,
    });
    expect(resources.walkHierarchy(child)).toEqual([
      { type: "view", viewId: "pstdio-planner.tickets", label: "Tickets", icon: "square-kanban" },
      parent,
      child,
    ]);
  });
  test("walks canonical parent edges into a root-to-leaf resource path", () => {
    const resources = createResourceRegistry();
    const tickets = {
      type: "dashboard-view",
      label: "Tickets",
      id: "pstdio://tickets",
    };
    const parent = {
      type: "ticket",
      label: "PS-1 Parent",
      id: "pstdio://ticket/parent",
    };
    const child = {
      type: "ticket",
      label: "PS-2 Child",
      id: "pstdio://ticket/child",
    };
    const parents = new Map([
      [resourceKey(parent), tickets],
      [resourceKey(child), parent],
    ]);
    resources.registerHierarchyProvider({
      id: "tickets",
      canResolve: (resource) => resource.type === "ticket",
      getParent: (resource) => parents.get(resourceKey(resource)),
    });
    const cycles: ResourceHierarchyCycle[] = [];
    resources.onDidDetectHierarchyCycle((cycle) => cycles.push(cycle));
    expect(resources.walkHierarchy(child)).toEqual([tickets, parent, child]);
    expect(cycles).toEqual([]);
  });
  test("does not resolve hierarchy providers for a null selection", () => {
    const resources = createResourceRegistry();
    let reads = 0;
    resources.registerHierarchyProvider({
      id: "tickets",
      canResolve: () => true,
      getParent: () => {
        reads += 1;
        return undefined;
      },
    });
    expect(resources.walkHierarchy(undefined)).toEqual([]);
    expect(reads).toBe(0);
  });
  test("stops at a repeated resource edge with the acyclic prefix and reports the cycle", () => {
    const resources = createResourceRegistry();
    const parent = {
      type: "ticket",
      id: "pstdio://ticket/parent",
    };
    const child = {
      type: "ticket",
      id: "pstdio://ticket/child",
    };
    const cycles: ResourceHierarchyCycle[] = [];
    resources.registerHierarchyProvider({
      id: "tickets",
      canResolve: () => true,
      getParent: (resource) => (resourceKey(resource) === resourceKey(child) ? parent : child),
    });
    resources.onDidDetectHierarchyCycle((cycle) => cycles.push(cycle));
    expect(resources.walkHierarchy(child)).toEqual([parent, child]);
    expect(cycles).toEqual([
      {
        code: "resource_hierarchy_cycle",
        path: [parent, child],
        repeatedUri: resourceKey(child),
      },
    ]);
  });
  test("stops listening for cycles after the subscription is disposed", () => {
    const resources = createResourceRegistry();
    const ticket = {
      type: "ticket",
      id: "pstdio://ticket/self",
    };
    const cycles: ResourceHierarchyCycle[] = [];
    resources.registerHierarchyProvider({
      id: "tickets",
      canResolve: () => true,
      getParent: () => ticket,
    });
    const subscription = resources.onDidDetectHierarchyCycle((cycle) => cycles.push(cycle));
    subscription.dispose();
    expect(resources.walkHierarchy(ticket)).toEqual([ticket]);
    expect(cycles).toEqual([]);
  });
  test("uses the highest priority hierarchy provider that can resolve a resource", () => {
    const resources = createResourceRegistry();
    const ticket = {
      type: "ticket",
      id: "pstdio://ticket/child",
    };
    const fallback = {
      type: "dashboard-view",
      id: "pstdio://fallback",
    };
    const tickets = {
      type: "dashboard-view",
      id: "pstdio://tickets",
    };
    resources.registerHierarchyProvider({
      id: "fallback",
      priority: 1,
      canResolve: (resource) => resource.type === "ticket",
      getParent: () => fallback,
    });
    resources.registerHierarchyProvider({
      id: "tickets",
      priority: 100,
      canResolve: (resource) => resource.type === "ticket",
      getParent: () => tickets,
    });
    expect(resources.walkHierarchy(ticket)).toEqual([tickets, ticket]);
  });
});
describe("createResourceRegistry", () => {
  test("registers resource kinds with contribution metadata", () => {
    const resources = createResourceRegistry();
    resources.registerKind(
      {
        kind: "session",
        label: "Session",
        icon: "message-circle",
      },
      { source: "module", ownerId: "pstdio.sessions", priority: 20 },
    );
    expect(resources.getKind("session")).toMatchObject({
      kind: "session",
      label: "Session",
      source: "module",
      ownerId: "pstdio.sessions",
    });
  });
  test("aggregates browse entries from registered providers", () => {
    const resources = createResourceRegistry();
    resources.registerKind({ kind: "ticket", label: "Ticket" });
    resources.registerKind({ kind: "session", label: "Session" });
    resources.registerProvider({
      id: "tickets",
      kind: "ticket",
      list: () => [
        {
          resource: {
            type: "ticket",
            label: "PS-1 Ship it",
            id: "pstdio://ticket/PS-1",
          },
        },
      ],
    });
    resources.registerProvider({
      id: "sessions",
      kind: "session",
      list: () => [
        {
          resource: {
            type: "session",
            label: "Session 1",
            id: "pstdio://session/s1",
          },
        },
      ],
    });
    expect(resources.listResources("").map((entry) => entry.resource.id)).toEqual([
      "pstdio://ticket/PS-1",
      "pstdio://session/s1",
    ]);
  });
  test("passes the query to each provider's list function", () => {
    const resources = createResourceRegistry();
    resources.registerKind({ kind: "ticket", label: "Ticket" });
    const seenQueries: string[] = [];
    resources.registerProvider({
      id: "tickets",
      kind: "ticket",
      list: (query) => {
        seenQueries.push(query);
        return [];
      },
    });
    resources.listResources("hello");
    expect(seenQueries).toEqual(["hello"]);
  });
  test("disposing a provider removes its entries from listResources", () => {
    const resources = createResourceRegistry();
    resources.registerKind({ kind: "ticket", label: "Ticket" });
    const handle = resources.registerProvider({
      id: "tickets",
      kind: "ticket",
      list: () => [
        {
          resource: {
            type: "ticket",
            label: "PS-1",
            id: "pstdio://ticket/PS-1",
          },
        },
      ],
    });
    expect(resources.listResources("")).toHaveLength(1);
    handle.dispose();
    expect(resources.listResources("")).toHaveLength(0);
  });
});
