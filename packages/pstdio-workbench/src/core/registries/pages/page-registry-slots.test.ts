import { describe, expect, test } from "bun:test";
import { getWorkbenchPageRegistryInternals } from "./page-registry-internals";
import {
  activatePage,
  activePagePlacements,
  closePlacement,
  createRegistry,
  pageIdentity,
  registerPage,
} from "./page-registry-test-support";

describe("page primary slot lifecycle", () => {
  test("resolves static-only, bound-only, and hybrid primary targets explicitly", () => {
    const registry = createRegistry();
    registerPage(registry, {
      id: "static",
      modeId: "project",
      slots: [{ id: "content", role: "primary", region: "main", viewId: "list" }],
    });
    registerPage(registry, {
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
    registerPage(registry, {
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

    expect(() => activatePage(registry, { pageId: "static", resource: { type: "ticket", id: "one" } })).toThrow(
      /does not accept a resource/,
    );
    expect(() => activatePage(registry, { pageId: "bound" })).toThrow(/requires a resource/);

    activatePage(registry, { pageId: "hybrid" });
    expect(activePagePlacements(registry, "content")[0]?.identity.instanceKey).toBe("default");
    expect(activePagePlacements(registry, "content")[0]?.value.identity).toEqual(
      pageIdentity("hybrid", "content", "default"),
    );
    activatePage(registry, { pageId: "hybrid", resource: { type: "ticket", id: "one" } });
    expect(activePagePlacements(registry, "content").map((candidate) => candidate.identity.instanceKey)).toEqual([
      "default",
      "ticket:one",
    ]);
    expect(registry.store.getState().reconciliation.activate[0]?.identity).toEqual(
      pageIdentity("hybrid", "content", "ticket:one"),
    );
    activatePage(registry, { pageId: "hybrid" });
    expect(registry.store.getState().reconciliation.activate[0]?.identity).toEqual(
      pageIdentity("hybrid", "content", "default"),
    );
  });

  test("owns preview replacement and pinning inside one many slot", () => {
    const registry = createRegistry();
    registerPage(registry, {
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

    activatePage(registry, { pageId: "files", resource: { type: "file", id: "A" } });
    activatePage(registry, { pageId: "files", resource: { type: "file", id: "B" } });
    activatePage(registry, { pageId: "files", resource: { type: "file", id: "B" }, open: "pin" });
    activatePage(registry, { pageId: "files", resource: { type: "file", id: "C" } });

    const placements = activePagePlacements(registry, "content");
    expect(placements.map((candidate) => candidate.identity.instanceKey)).toEqual(["file:B", "file:C"]);
    expect(placements.map((candidate) => candidate.value.open)).toEqual(["pin", "preview"]);
  });

  test("updates one existing resource instance when metadata or section changes", () => {
    const registry = createRegistry();
    registerPage(registry, {
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
    activatePage(registry, {
      pageId: "ticket",
      resource: { type: "ticket", id: "PS-326", metadata: { revision: 1 } },
    });

    activatePage(registry, {
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
    registerPage(registry, {
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
    activatePage(registry, { pageId: "compare", resource: file });
    getWorkbenchPageRegistryInternals(registry).openPanel({
      kind: "panel",
      panel: {
        kind: "page-slot",
        page: { extensionId: "pstdio.test", kind: "page", id: "compare" },
        id: "right",
      },
      resource: file,
    });

    expect(registry.store.getState().placements.map((candidate) => candidate.identity)).toEqual([
      pageIdentity("compare", "left", "file:same"),
      pageIdentity("compare", "right", "file:same"),
    ]);
  });
});
describe("page placement close lifecycle", () => {
  test("closes only the exact auxiliary placement and does not activate default-open auxiliaries", () => {
    const registry = createRegistry();
    registerPage(registry, {
      id: "tools",
      modeId: "project",
      slots: [
        { id: "content", role: "primary", region: "main", viewId: "content" },
        { id: "emoji", role: "auxiliary", region: "side", viewId: "emoji", defaultOpen: true, closable: true },
        { id: "notes", role: "auxiliary", region: "side", viewId: "notes", defaultOpen: true, closable: true },
      ],
    });
    activatePage(registry, { pageId: "tools" });
    expect(registry.store.getState().reconciliation.activate.map((candidate) => candidate.identity)).toEqual([
      pageIdentity("tools", "content", "default"),
    ]);

    closePlacement(registry, pageIdentity("tools", "emoji", "default"));

    expect(activePagePlacements(registry, "emoji")).toEqual([]);
    expect(activePagePlacements(registry, "notes")).toHaveLength(1);
    expect(registry.store.getState().reconciliation.remove.map((candidate) => candidate.identity)).toEqual([
      pageIdentity("tools", "emoji", "default"),
    ]);
  });

  test("falls back to the hybrid default and moves a bound-only last close to its parent", () => {
    const registry = createRegistry();
    registerPage(registry, {
      id: "list",
      modeId: "project",
      slots: [{ id: "content", role: "primary", region: "main", viewId: "list" }],
    });
    registerPage(registry, {
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
    registerPage(registry, {
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

    activatePage(registry, { pageId: "hybrid", resource: { type: "ticket", id: "one" } });
    closePlacement(registry, pageIdentity("hybrid", "content", "ticket:one"));
    expect(registry.store.getState().activePageId).toBe("hybrid");
    expect(activePagePlacements(registry, "content")[0]?.identity.instanceKey).toBe("default");

    activatePage(registry, { pageId: "detail", resource: { type: "ticket", id: "two" } });
    const observed: string[] = [];
    const unsubscribe = registry.store.subscribe((state) => observed.push(state.activePageId ?? "none"));
    closePlacement(registry, pageIdentity("detail", "content", "ticket:two"));
    unsubscribe();

    expect(observed).toEqual(["list"]);
    expect(registry.store.getState().activePageId).toBe("list");
    expect(activePagePlacements(registry, "content")[0]?.value.viewId).toBe("list");
  });
});
