import { describe, expect, test } from "bun:test";
import { activatePage, createRegistry, pageIdentity, registerPage } from "./page-registry-test-helpers";

describe("page inspector lifecycle", () => {
  test("keeps the same resource independent in two explicitly named slots", () => {
    const registry = createRegistry();
    registerPage(registry, {
      id: "compare",
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
        cardinality: "one",
      },
      slots: [
        {
          id: "right",
          region: "side",
          item: {
            kind: "binding",
            binding: {
              kinds: [
                {
                  kind: "resource-kind",
                  id: "file",
                },
              ],
              view: {
                kind: "view",
                id: "editor",
              },
              cardinality: "one",
            },
          },
        },
      ],
    });
    const file = { type: "file", id: "same" };
    activatePage(registry, { pageId: "compare", resource: file });
    registry.openSlot({ pageId: "compare", slotId: "right", resource: file });
    expect(registry.store.getState().placements.map((candidate) => candidate.identity)).toEqual([
      pageIdentity("compare", "$main", "single"),
      pageIdentity("compare", "right", "single"),
    ]);
  });
  test("opens default auxiliary bindings with the page resource", () => {
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
          id: "editor",
        },
        cardinality: "one",
      },
      slots: [
        {
          id: "files",
          region: "secondary",
          openOn: "page-resource",
          item: {
            kind: "binding",
            binding: {
              kinds: [
                {
                  kind: "resource-kind",
                  id: "ticket",
                },
              ],
              view: {
                kind: "view",
                id: "files",
              },
              cardinality: "one",
            },
          },
        },
      ],
    });
    activatePage(registry, { pageId: "ticket", resource: { type: "ticket", id: "PS-326" } });
    expect(registry.store.getState().placements.map((candidate) => candidate.identity)).toEqual([
      pageIdentity("ticket", "$main", "single"),
      pageIdentity("ticket", "files", "single"),
    ]);
    expect(registry.store.getState().reconciliation.activate.map((candidate) => candidate.identity)).toEqual([
      pageIdentity("ticket", "$main", "single"),
      pageIdentity("ticket", "files", "single"),
    ]);
  });
});
