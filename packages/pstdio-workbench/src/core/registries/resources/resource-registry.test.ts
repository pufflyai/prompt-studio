import { describe, expect, test } from "bun:test";
import { createResourceRegistry } from "./resource-registry";

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

  test("opens resources with the highest priority matching opener", async () => {
    const resources = createResourceRegistry();
    const resource = { kind: "session", uri: "pstdio://session/s1", label: "Session 1" };

    resources.registerKind({ kind: "session", label: "Session" });
    resources.registerOpener({
      id: "fallback",
      priority: 1,
      canOpen: () => true,
      open: () => "fallback",
    });
    resources.registerOpener({
      id: "session-chat",
      priority: 50,
      canOpen: ({ kind }) => kind === "session",
      open: ({ uri }) => `opened:${uri}`,
    });

    await expect(resources.openResource(resource)).resolves.toBe("opened:pstdio://session/s1");
  });

  test("passes open options to the selected opener", async () => {
    const resources = createResourceRegistry();
    const resource = { kind: "session", uri: "pstdio://session/s1", label: "Session 1" };

    resources.registerKind({ kind: "session", label: "Session" });
    resources.registerOpener({
      id: "session-chat",
      canOpen: ({ kind }) => kind === "session",
      open: (_resource, options) => options.replaceActive,
    });

    await expect(resources.openResource(resource, { replaceActive: true })).resolves.toBe(true);
  });

  test("fails clearly when no opener can handle a known resource", async () => {
    const resources = createResourceRegistry();

    resources.registerKind({ kind: "template", label: "Template" });

    await expect(resources.openResource({ kind: "template", uri: "pstdio://template/t1" })).rejects.toThrow(
      "No opener registered for resource kind: template",
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
