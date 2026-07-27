import { describe, expect, test } from "bun:test";
import { createResourceRegistry } from "./resource-registry";

const panelInstance = (id: string) => ({ instanceId: id, panelId: "test-panel", closable: false });

describe("createResourceRegistry scoped candidates", () => {
  test("passes the active primary resource to providers so candidates can be scoped", () => {
    const workspaceA = { kind: "workspace", uri: "pstdio://workspace/a" };
    let primary = workspaceA;
    const resources = createResourceRegistry({ getPrimary: () => primary });

    resources.registerProvider({
      id: "sessions",
      kind: "session",
      // Only list sessions belonging to the primary workspace.
      list: (_query, context) =>
        context.primary?.uri === "pstdio://workspace/a"
          ? [{ resource: { kind: "session", uri: "pstdio://session/a1" } }]
          : [],
    });

    expect(resources.listResources("").map((entry) => entry.resource.uri)).toEqual(["pstdio://session/a1"]);

    primary = { kind: "workspace", uri: "pstdio://workspace/b" };
    expect(resources.listResources("")).toEqual([]);
  });
});

describe("createResourceRegistry surface routing", () => {
  test("reports the anchor a resource routes to via its kind", () => {
    const resources = createResourceRegistry();
    resources.registerKind({ kind: "session", label: "Session", surface: "attached" });
    resources.registerKind({ kind: "terminal", label: "Terminal", surface: "secondary" });
    resources.registerKind({ kind: "workspace", label: "Workspace", surface: "primary" });
    resources.registerKind({ kind: "note", label: "Note" });

    expect(resources.getSurface({ kind: "session", uri: "pstdio://session/a" })).toBe("attached");
    expect(resources.getSurface({ kind: "terminal", uri: "pstdio://terminal/a" })).toBe("secondary");
    expect(resources.getSurface({ kind: "workspace", uri: "pstdio://workspace/a" })).toBe("primary");
    expect(resources.getSurface({ kind: "note", uri: "pstdio://note/a" })).toBeUndefined();
  });
});

describe("createResourceRegistry hierarchy", () => {
  test("walks canonical parent edges into a root-to-leaf resource path", () => {
    const resources = createResourceRegistry();
    const tickets = { kind: "dashboard-view", uri: "pstdio://tickets", label: "Tickets" };
    const parent = { kind: "ticket", uri: "pstdio://ticket/parent", label: "PS-1 Parent" };
    const child = { kind: "ticket", uri: "pstdio://ticket/child", label: "PS-2 Child" };
    const parents = new Map([
      [parent.uri, tickets],
      [child.uri, parent],
    ]);

    resources.registerHierarchyProvider({
      id: "tickets",
      canResolve: (resource) => resource.kind === "ticket",
      getParent: (resource) => parents.get(resource.uri),
    });

    expect(resources.walkHierarchy(child)).toEqual([tickets, parent, child]);
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

  test("stops at a repeated resource edge", () => {
    const resources = createResourceRegistry();
    const parent = { kind: "ticket", uri: "pstdio://ticket/parent" };
    const child = { kind: "ticket", uri: "pstdio://ticket/child" };

    resources.registerHierarchyProvider({
      id: "tickets",
      canResolve: () => true,
      getParent: (resource) => (resource.uri === child.uri ? parent : child),
    });

    expect(resources.walkHierarchy(child)).toEqual([parent, child]);
  });

  test("uses the highest priority hierarchy provider that can resolve a resource", () => {
    const resources = createResourceRegistry();
    const ticket = { kind: "ticket", uri: "pstdio://ticket/child" };
    const fallback = { kind: "dashboard-view", uri: "pstdio://fallback" };
    const tickets = { kind: "dashboard-view", uri: "pstdio://tickets" };

    resources.registerHierarchyProvider({
      id: "fallback",
      priority: 1,
      canResolve: (resource) => resource.kind === "ticket",
      getParent: () => fallback,
    });
    resources.registerHierarchyProvider({
      id: "tickets",
      priority: 100,
      canResolve: (resource) => resource.kind === "ticket",
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

  test("opens resources with the highest priority matching presenter", async () => {
    const resources = createResourceRegistry();
    const resource = { kind: "session", uri: "pstdio://session/s1", label: "Session 1" };

    resources.registerKind({ kind: "session", label: "Session" });
    resources.registerPresenter({
      id: "fallback",
      priority: 1,
      canOpen: () => true,
      open: () => panelInstance("fallback"),
    });
    resources.registerPresenter({
      id: "session-chat",
      priority: 50,
      canOpen: ({ kind }) => kind === "session",
      open: ({ uri }) => panelInstance(`opened:${uri}`),
    });

    await expect(resources.openResource(resource)).resolves.toEqual(panelInstance("opened:pstdio://session/s1"));
  });

  test("passes open options to the selected presenter", async () => {
    const resources = createResourceRegistry();
    const resource = { kind: "session", uri: "pstdio://session/s1", label: "Session 1" };

    resources.registerKind({ kind: "session", label: "Session" });
    resources.registerPresenter({
      id: "session-chat",
      canOpen: ({ kind }) => kind === "session",
      open: (_resource, options) => panelInstance(String(options.replaceActive)),
    });

    await expect(resources.openResource(resource, { replaceActive: true })).resolves.toEqual(panelInstance("true"));
  });

  test("fails clearly when no presenter can handle a known resource", async () => {
    const resources = createResourceRegistry();

    resources.registerKind({ kind: "template", label: "Template" });

    await expect(resources.openResource({ kind: "template", uri: "pstdio://template/t1" })).rejects.toThrow(
      "No presenter registered for resource kind: template",
    );
  });

  test("aggregates browse entries from registered providers", () => {
    const resources = createResourceRegistry();
    resources.registerKind({ kind: "ticket", label: "Ticket" });
    resources.registerKind({ kind: "session", label: "Session" });

    resources.registerProvider({
      id: "tickets",
      kind: "ticket",
      list: () => [{ resource: { kind: "ticket", uri: "pstdio://ticket/PS-1", label: "PS-1 Ship it" } }],
    });
    resources.registerProvider({
      id: "sessions",
      kind: "session",
      list: () => [{ resource: { kind: "session", uri: "pstdio://session/s1", label: "Session 1" } }],
    });

    expect(resources.listResources("").map((entry) => entry.resource.uri)).toEqual([
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
      list: () => [{ resource: { kind: "ticket", uri: "pstdio://ticket/PS-1", label: "PS-1" } }],
    });

    expect(resources.listResources("")).toHaveLength(1);
    handle.dispose();
    expect(resources.listResources("")).toHaveLength(0);
  });
});
