import { describe, expect, test } from "bun:test";
import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import {
  createWorkbenchPageRegistry,
  type WorkbenchPageContribution,
  type WorkbenchPageOpenInput,
  type WorkbenchPagePlacementInput,
} from "./page-registry";
import { getWorkbenchPageRegistryInternals } from "./page-registry-internals";

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
    resources: {
      normalize: (resource) => ({ ...resource }),
      toUri: (resource) => `${resource.type}:${resource.id}`,
      fromUri: () => undefined,
    },
    valuesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
  });
type PageInput = Omit<WorkbenchPageContribution, "ref" | "path">;
const registerPage = (registry: ReturnType<typeof createRegistry>, page: PageInput) =>
  registry.registerPage({
    ...(page.resource && !page.parentId ? { parentId: "collection" } : {}),
    ...page,
    ref: { extensionId: "pstdio.test", kind: "page", id: page.id },
    path: page.id,
  });
const activatePage = (
  registry: ReturnType<typeof createRegistry>,
  target: WorkbenchPageOpenInput,
  pageStates?: ReturnType<typeof registry.store.getState>["pageStates"],
) => {
  const page = registry.getPage(target.pageId);
  if (!page) throw new Error(`Unknown test page: ${target.pageId}`);
  getWorkbenchPageRegistryInternals(registry).activateLocation({
    ...target,
    projectId: "test-project",
    location: {
      page: page.ref,
      ...(target.resource ? { resource: target.resource } : {}),
      ...(target.section ? { section: target.section } : {}),
    },
    pageStates,
    action: "testActivatePage",
  });
};
const closePlacement = (registry: ReturnType<typeof createRegistry>, identity: PlacementIdentity) => {
  const internals = getWorkbenchPageRegistryInternals(registry);
  const result = internals.resolveClosePlacement(identity);
  if (result.kind === "parent") {
    activatePage(registry, { pageId: result.parentId }, result.pageStates);
    return;
  }
  activatePage(registry, result.target, result.pageStates);
};
const activePagePlacements = (registry: ReturnType<typeof createRegistry>, slotId: string) =>
  registry.store
    .getState()
    .placements.filter((candidate) => candidate.identity.kind === "page" && candidate.identity.slotId === slotId);
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
      "ticket:one",
    ]);
    expect(registry.store.getState().reconciliation.activate[0]?.identity).toEqual(
      pageIdentity("bound", "$main", "ticket:one"),
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
    expect(activePagePlacements(registry, "$main").map((item) => item.identity.instanceKey)).toEqual(["session:one"]);
    activatePage(registry, { pageId: "sessions", resource: { type: "session", id: "two" } });
    expect(activePagePlacements(registry, "$main").map((item) => item.identity.instanceKey)).toEqual(["session:two"]);
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
      pageIdentity("compare", "$main", "file:same"),
      pageIdentity("compare", "right", "file:same"),
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
      pageIdentity("ticket", "$main", "ticket:PS-326"),
      pageIdentity("ticket", "files", "ticket:PS-326"),
    ]);
    expect(registry.store.getState().reconciliation.activate.map((candidate) => candidate.identity)).toEqual([
      pageIdentity("ticket", "$main", "ticket:PS-326"),
      pageIdentity("ticket", "files", "ticket:PS-326"),
    ]);
  });
});
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
        cardinality: "one",
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
