import { describe, expect, test } from "bun:test";
import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { createWorkbenchPageRegistry, type WorkbenchPagePlacementInput } from "./page-registry";

const pageIdentity = (pageId: string, slotId: string, instanceKey: string): PlacementIdentity => ({
  kind: "page",
  pageId,
  slotId,
  instanceKey,
});

const createRegistry = () =>
  createWorkbenchPageRegistry<WorkbenchPagePlacementInput>({
    resolveShellPlacements: () => [],
    resolveModePlacements: () => [],
    resolvePagePlacement: (input) => input,
    resourceKey: (resource) => `${resource.type}:${resource.id}`,
    valuesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
  });

const activePagePlacements = (registry: ReturnType<typeof createRegistry>, slotId: string) =>
  registry.store
    .getState()
    .placements.filter((candidate) => candidate.identity.kind === "page" && candidate.identity.slotId === slotId);

describe("page primary slot lifecycle", () => {
  test("resolves static-only, bound-only, and hybrid primary targets explicitly", () => {
    const registry = createRegistry();
    registry.registerPage({
      id: "static",
      modeId: "project",
      slots: [{ id: "content", role: "primary", region: "main", viewId: "list" }],
    });
    registry.registerPage({
      id: "bound",
      modeId: "project",
      parentId: "static",
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          binding: { resourceKind: "ticket", viewId: "detail" },
        },
      ],
    });
    registry.registerPage({
      id: "hybrid",
      modeId: "project",
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          viewId: "list",
          binding: { resourceKind: "ticket", viewId: "detail" },
        },
      ],
    });

    expect(() => registry.activatePage({ pageId: "static", resource: { type: "ticket", id: "one" } })).toThrow(
      /does not accept a resource/,
    );
    expect(() => registry.activatePage({ pageId: "bound" })).toThrow(/requires a resource/);

    registry.activatePage({ pageId: "hybrid" });
    expect(activePagePlacements(registry, "content")[0]?.identity.instanceKey).toBe("default");
    registry.activatePage({ pageId: "hybrid", resource: { type: "ticket", id: "one" } });
    expect(activePagePlacements(registry, "content").map((candidate) => candidate.identity.instanceKey)).toEqual([
      "default",
      "ticket:one",
    ]);
    expect(registry.store.getState().reconciliation.activate[0]?.identity).toEqual(
      pageIdentity("hybrid", "content", "ticket:one"),
    );
    registry.activatePage({ pageId: "hybrid" });
    expect(registry.store.getState().reconciliation.activate[0]?.identity).toEqual(
      pageIdentity("hybrid", "content", "default"),
    );
  });

  test("owns preview replacement and pinning inside one many slot", () => {
    const registry = createRegistry();
    registry.registerPage({
      id: "files",
      modeId: "project",
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          cardinality: "many",
          closable: true,
          binding: { resourceKind: "file", viewId: "editor" },
        },
      ],
    });

    registry.activatePage({ pageId: "files", resource: { type: "file", id: "A" } });
    registry.activatePage({ pageId: "files", resource: { type: "file", id: "B" } });
    registry.activatePage({ pageId: "files", resource: { type: "file", id: "B" }, open: "pin" });
    registry.activatePage({ pageId: "files", resource: { type: "file", id: "C" } });

    const placements = activePagePlacements(registry, "content");
    expect(placements.map((candidate) => candidate.identity.instanceKey)).toEqual(["file:B", "file:C"]);
    expect(placements.map((candidate) => candidate.value.open)).toEqual(["pin", "preview"]);
  });

  test("updates one existing resource instance when metadata or section changes", () => {
    const registry = createRegistry();
    registry.registerPage({
      id: "ticket",
      modeId: "project",
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          cardinality: "many",
          binding: { resourceKind: "ticket", viewId: "detail" },
        },
      ],
    });
    registry.activatePage({
      pageId: "ticket",
      resource: { type: "ticket", id: "PS-326", metadata: { revision: 1 } },
    });

    registry.activatePage({
      pageId: "ticket",
      resource: { type: "ticket", id: "PS-326", metadata: { revision: 2 } },
      section: { anchors: [{ id: "acceptance", heading: "Acceptance" }] },
    });

    const state = registry.store.getState();
    expect(activePagePlacements(registry, "content")).toHaveLength(1);
    expect(state.reconciliation.add).toEqual([]);
    expect(state.reconciliation.remove).toEqual([]);
    expect(state.reconciliation.update).toHaveLength(1);
    expect(state.reconciliation.update[0]?.desired.value.resource?.metadata).toEqual({ revision: 2 });
    expect(state.reconciliation.update[0]?.desired.value.section?.anchors[0]?.id).toBe("acceptance");
  });

  test("keeps the same resource independent in two explicitly named slots", () => {
    const registry = createRegistry();
    registry.registerPage({
      id: "compare",
      modeId: "project",
      slots: [
        {
          id: "left",
          role: "primary",
          region: "main",
          binding: { resourceKind: "file", viewId: "editor" },
        },
        {
          id: "right",
          role: "auxiliary",
          region: "side",
          binding: { resourceKind: "file", viewId: "editor" },
        },
      ],
    });
    const file = { type: "file", id: "same" };
    registry.activatePage({ pageId: "compare", resource: file });
    registry.openSlot({ pageId: "compare", slotId: "right", resource: file });

    expect(registry.store.getState().placements.map((candidate) => candidate.identity)).toEqual([
      pageIdentity("compare", "left", "file:same"),
      pageIdentity("compare", "right", "file:same"),
    ]);
  });
});

describe("page placement close lifecycle", () => {
  test("closes only the exact auxiliary placement and does not activate default-open auxiliaries", () => {
    const registry = createRegistry();
    registry.registerPage({
      id: "tools",
      modeId: "project",
      slots: [
        { id: "content", role: "primary", region: "main", viewId: "content" },
        { id: "emoji", role: "auxiliary", region: "side", viewId: "emoji", defaultOpen: true, closable: true },
        { id: "notes", role: "auxiliary", region: "side", viewId: "notes", defaultOpen: true, closable: true },
      ],
    });
    registry.activatePage({ pageId: "tools" });
    expect(registry.store.getState().reconciliation.activate.map((candidate) => candidate.identity)).toEqual([
      pageIdentity("tools", "content", "default"),
    ]);

    registry.closePlacement(pageIdentity("tools", "emoji", "default"));

    expect(activePagePlacements(registry, "emoji")).toEqual([]);
    expect(activePagePlacements(registry, "notes")).toHaveLength(1);
    expect(registry.store.getState().reconciliation.remove.map((candidate) => candidate.identity)).toEqual([
      pageIdentity("tools", "emoji", "default"),
    ]);
  });

  test("falls back to the hybrid default and moves a bound-only last close to its parent", () => {
    const registry = createRegistry();
    registry.registerPage({
      id: "list",
      modeId: "project",
      slots: [{ id: "content", role: "primary", region: "main", viewId: "list" }],
    });
    registry.registerPage({
      id: "hybrid",
      modeId: "project",
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          cardinality: "many",
          closable: true,
          viewId: "list",
          binding: { resourceKind: "ticket", viewId: "detail" },
        },
      ],
    });
    registry.registerPage({
      id: "detail",
      modeId: "project",
      parentId: "list",
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          closable: true,
          binding: { resourceKind: "ticket", viewId: "detail" },
        },
      ],
    });

    registry.activatePage({ pageId: "hybrid", resource: { type: "ticket", id: "one" } });
    registry.closePlacement(pageIdentity("hybrid", "content", "ticket:one"));
    expect(registry.store.getState().activePageId).toBe("hybrid");
    expect(activePagePlacements(registry, "content")[0]?.identity.instanceKey).toBe("default");

    registry.activatePage({ pageId: "detail", resource: { type: "ticket", id: "two" } });
    const observed: string[] = [];
    const unsubscribe = registry.store.subscribe((state) => observed.push(state.activePageId ?? "none"));
    registry.closePlacement(pageIdentity("detail", "content", "ticket:two"));
    unsubscribe();

    expect(observed).toEqual(["list"]);
    expect(registry.store.getState().activePageId).toBe("list");
    expect(activePagePlacements(registry, "content")[0]?.value.viewId).toBe("list");
  });
});
