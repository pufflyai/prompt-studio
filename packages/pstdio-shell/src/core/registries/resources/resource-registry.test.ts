import { describe, expect, test } from "bun:test";
import { createResourceRegistry } from "./resource-registry";

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
});
