import { describe, expect, test } from "bun:test";
import {
  activatePage,
  activePagePlacements,
  createRegistry,
  pageIdentity,
  registerPage,
} from "./page-registry-test-helpers";

describe("page primary slot lifecycle", () => {
  test("resolves static and resource pages explicitly", () => {
    const registry = createRegistry();
    registerPage(registry, {
      id: "static",
      modeId: "project",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "list",
        },
        cardinality: "one",
      },
      slots: [],
    });
    registerPage(registry, {
      id: "bound",
      modeId: "project",
      parentId: "static",
      resource: {
        kinds: [
          {
            kind: "resource-kind",
            id: "ticket",
          },
        ],
      },
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "detail",
        },
        cardinality: "one",
      },
      slots: [],
    });
    expect(() => activatePage(registry, { pageId: "static", resource: { type: "ticket", id: "one" } })).toThrow(
      /does not accept a resource/,
    );
    expect(() => activatePage(registry, { pageId: "bound" })).toThrow(/requires a resource/);
    activatePage(registry, { pageId: "static" });
    expect(activePagePlacements(registry, "$main")[0]?.identity.instanceKey).toBe("default");
    expect(activePagePlacements(registry, "$main")[0]?.value.identity).toEqual(
      pageIdentity("static", "$main", "default"),
    );
    activatePage(registry, { pageId: "bound", resource: { type: "ticket", id: "one" } });
    expect(activePagePlacements(registry, "$main").map((candidate) => candidate.identity.instanceKey)).toEqual([
      "single",
    ]);
    expect(registry.store.getState().reconciliation.activate[0]?.identity).toEqual(
      pageIdentity("bound", "$main", "single"),
    );
    activatePage(registry, { pageId: "static" });
    expect(registry.store.getState().reconciliation.activate[0]?.identity).toEqual(
      pageIdentity("static", "$main", "default"),
    );
  });
  test("replaces the primary resource of a one-cardinality page", () => {
    const registry = createRegistry();
    registerPage(registry, {
      id: "sessions",
      modeId: "sessions",
      resource: {
        kinds: [
          {
            kind: "resource-kind",
            id: "session",
          },
        ],
      },
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "session",
        },
        cardinality: "one",
      },
      slots: [],
    });
    activatePage(registry, { pageId: "sessions", resource: { type: "session", id: "one" } });
    const first = activePagePlacements(registry, "$main")[0]!;
    expect(first.value.resource?.id).toBe("one");
    activatePage(registry, { pageId: "sessions", resource: { type: "session", id: "two" } });
    const next = activePagePlacements(registry, "$main");
    expect(next).toHaveLength(1);
    expect(next[0]?.value.resource?.id).toBe("two");
    expect(next[0]?.identity).toEqual(first.identity);
    expect(registry.store.getState().reconciliation.remove).toEqual([]);
    expect(registry.store.getState().reconciliation.add).toEqual([]);
  });
  test("owns preview replacement and pinning inside one many slot", () => {
    const registry = createRegistry();
    registerPage(registry, {
      id: "files",
      modeId: "project",
      resource: {
        kinds: [
          {
            kind: "resource-kind",
            id: "file",
          },
        ],
      },
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "editor",
        },
        cardinality: "many",
      },
      slots: [],
    });
    activatePage(registry, { pageId: "files", resource: { type: "file", id: "A" } });
    activatePage(registry, { pageId: "files", resource: { type: "file", id: "B" } });
    activatePage(registry, { pageId: "files", resource: { type: "file", id: "B" }, open: "pin" });
    activatePage(registry, { pageId: "files", resource: { type: "file", id: "C" } });
    const placements = activePagePlacements(registry, "$main");
    expect(placements.map((candidate) => candidate.identity.instanceKey)).toEqual(["file:B", "file:C"]);
    expect(placements.map((candidate) => candidate.value.open)).toEqual(["pin", "preview"]);
  });
  test("updates one existing resource instance when metadata or section changes", () => {
    const registry = createRegistry();
    registerPage(registry, {
      id: "ticket",
      modeId: "project",
      resource: {
        kinds: [
          {
            kind: "resource-kind",
            id: "ticket",
          },
        ],
      },
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "detail",
        },
        cardinality: "many",
      },
      slots: [],
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
    expect(activePagePlacements(registry, "$main")).toHaveLength(1);
    expect(state.reconciliation.add).toEqual([]);
    expect(state.reconciliation.remove).toEqual([]);
    expect(state.reconciliation.update).toHaveLength(1);
    expect(state.reconciliation.update[0]?.desired.value.resource?.metadata).toEqual({ revision: 2 });
    expect(state.reconciliation.update[0]?.desired.value.section?.anchors[0]?.id).toBe("acceptance");
  });
});
