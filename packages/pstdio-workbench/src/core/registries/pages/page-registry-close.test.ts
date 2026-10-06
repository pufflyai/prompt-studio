import { describe, expect, test } from "bun:test";
import {
  activatePage,
  activePagePlacements,
  closePlacement,
  createRegistry,
  pageIdentity,
  registerPage,
} from "./page-registry-test-helpers";

describe("page placement close lifecycle", () => {
  test("closes only the exact auxiliary placement and does not activate default-open auxiliaries", () => {
    const registry = createRegistry();
    registerPage(registry, {
      id: "tools",
      modeId: "project",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "content",
        },
        cardinality: "one",
      },
      slots: [
        {
          id: "emoji",
          region: "side",
          item: {
            kind: "view",
            view: {
              kind: "view",
              id: "emoji",
            },
            presence: "open",
          },
        },
        {
          id: "notes",
          region: "side",
          item: {
            kind: "view",
            view: {
              kind: "view",
              id: "notes",
            },
            presence: "open",
          },
        },
      ],
    });
    activatePage(registry, { pageId: "tools" });
    expect(registry.store.getState().reconciliation.activate.map((candidate) => candidate.identity)).toEqual([
      pageIdentity("tools", "$main", "default"),
    ]);
    closePlacement(registry, pageIdentity("tools", "emoji", "default"));
    expect(activePagePlacements(registry, "emoji")).toEqual([]);
    expect(activePagePlacements(registry, "notes")).toHaveLength(1);
    expect(registry.store.getState().reconciliation.remove.map((candidate) => candidate.identity)).toEqual([
      pageIdentity("tools", "emoji", "default"),
    ]);
  });
  test("moves the last resource close to its declared parent in one update", () => {
    const registry = createRegistry();
    registerPage(registry, {
      id: "list",
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
      id: "detail",
      modeId: "project",
      parentId: "list",
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
    activatePage(registry, { pageId: "detail", resource: { type: "ticket", id: "two" } });
    const observed: string[] = [];
    const unsubscribe = registry.store.subscribe((state) => observed.push(state.activePageId ?? "none"));
    closePlacement(registry, pageIdentity("detail", "$main", "ticket:two"));
    unsubscribe();
    expect(observed).toEqual(["list"]);
    expect(registry.store.getState().activePageId).toBe("list");
    expect(activePagePlacements(registry, "$main")[0]?.value.viewId).toBe("list");
  });
});
