import { describe, expect, test } from "bun:test";
import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import {
  createWorkbenchPageRegistry,
  type WorkbenchPageContribution,
  type WorkbenchPageOpenInput,
  type WorkbenchPagePlacementInput,
  type WorkbenchPageRegistry,
} from "./page-registry";
import { getWorkbenchPageRegistryInternals } from "./page-registry-internals";

const placement = (
  identity: PlacementIdentity,
  region: ResolvedOwnedPlacement<string>["region"],
  value: string,
): ResolvedOwnedPlacement<string> => ({ identity, region, order: 0, value });
const createRegistry = () =>
  createWorkbenchPageRegistry<string>({
    resolveShellPlacements: () => [
      placement({ kind: "shell", placementId: "project-navigation", instanceKey: "default" }, "sidenav", "navigation"),
    ],
    resolveModePlacements: (modeId) => [
      placement({ kind: "mode", modeId, placementId: "shared", instanceKey: "default" }, "side", "shared"),
    ],
    resolvePagePlacement: (input: WorkbenchPagePlacementInput) =>
      `${input.viewId}:${input.resource?.id ?? "default"}:${input.section?.anchors[0]?.id ?? ""}`,
    resources: {
      normalize: (resource) => ({ ...resource }),
      toUri: (resource) => `${resource.type}:${resource.id}`,
      fromUri: () => undefined,
    },
    valuesEqual: (left, right) => left === right,
  });
type PageInput = Omit<WorkbenchPageContribution, "ref" | "path">;
const registerPage = (registry: WorkbenchPageRegistry<string>, page: PageInput) =>
  registry.registerPage({
    ...page,
    ref: { extensionId: "pstdio.test", kind: "page", id: page.id },
    path: page.id,
  });
const activatePage = (registry: WorkbenchPageRegistry<string>, target: WorkbenchPageOpenInput) => {
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
    action: "testActivatePage",
  });
};
const registerPages = (registry: WorkbenchPageRegistry<string>) => {
  registerPage(registry, {
    id: "tickets",
    modeId: "project",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "tickets-view",
      },
      cardinality: "one",
    },
    slots: [],
  });
  registerPage(registry, {
    id: "ticket",
    modeId: "project",
    parentId: "tickets",
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
    slots: [
      {
        id: "emoji",
        region: "side",
        item: {
          kind: "view",
          view: {
            kind: "view",
            id: "shared",
          },
          presence: "open",
        },
      },
    ],
  });
  registerPage(registry, {
    id: "sessions",
    modeId: "sessions",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "sessions-view",
      },
      cardinality: "one",
    },
    slots: [],
  });
};
const identityKey = (identity: PlacementIdentity) => {
  if (identity.kind === "shell") return `shell:${identity.placementId}:${identity.instanceKey}`;
  if (identity.kind === "mode") return `mode:${identity.modeId}:${identity.placementId}:${identity.instanceKey}`;
  return `page:${identity.pageId}:${identity.slotId}:${identity.instanceKey}`;
};
describe("createWorkbenchPageRegistry transitions", () => {
  test("starts with shell placements before any page is active", () => {
    const registry = createRegistry();
    expect(registry.store.getState().placements.map((candidate) => identityKey(candidate.identity))).toEqual([
      "shell:project-navigation:default",
    ]);
  });
  test("composes shell, mode, and page owners additively without sharing view instances", () => {
    const registry = createRegistry();
    registerPages(registry);
    activatePage(registry, { pageId: "ticket", resource: { type: "ticket", id: "PS-326" } });
    const state = registry.store.getState();
    expect(state.activeModeId).toBe("project");
    expect(state.activePageId).toBe("ticket");
    expect(state.placements.map((candidate) => identityKey(candidate.identity))).toEqual([
      "shell:project-navigation:default",
      "page:ticket:$main:ticket:PS-326",
      "mode:project:shared:default",
      "page:ticket:emoji:default",
    ]);
    expect(state.placements.filter((candidate) => candidate.value.startsWith("shared"))).toHaveLength(2);
  });
  test("keeps mode placements when only the page changes", () => {
    const registry = createRegistry();
    registerPages(registry);
    activatePage(registry, { pageId: "ticket", resource: { type: "ticket", id: "PS-326" } });
    activatePage(registry, { pageId: "tickets" });
    const reconciliation = registry.store.getState().reconciliation;
    expect(reconciliation.retain.map((candidate) => identityKey(candidate.identity))).toContain(
      "mode:project:shared:default",
    );
    expect(reconciliation.remove.map((candidate) => identityKey(candidate.identity))).toEqual([
      "page:ticket:$main:ticket:PS-326",
      "page:ticket:emoji:default",
    ]);
    expect(reconciliation.add.map((candidate) => identityKey(candidate.identity))).toEqual([
      "page:tickets:$main:default",
    ]);
  });
  test("publishes a mode and page change as one complete store transition", () => {
    const registry = createRegistry();
    registerPages(registry);
    activatePage(registry, { pageId: "ticket", resource: { type: "ticket", id: "PS-326" } });
    const observed: Array<{
      modeId?: string;
      pageId?: string;
      owners: string[];
    }> = [];
    const unsubscribe = registry.store.subscribe((state) => {
      observed.push({
        modeId: state.activeModeId,
        pageId: state.activePageId,
        owners: state.placements.map((candidate) => candidate.identity.kind),
      });
    });
    activatePage(registry, { pageId: "sessions" });
    unsubscribe();
    expect(observed).toEqual([
      {
        modeId: "sessions",
        pageId: "sessions",
        owners: ["shell", "page", "mode"],
      },
    ]);
    expect(
      registry.store.getState().reconciliation.activate.map((candidate) => identityKey(candidate.identity)),
    ).toEqual(["page:sessions:$main:default"]);
  });
  test("rejects mode placements owned by a different mode before changing state", () => {
    const registry = createWorkbenchPageRegistry<string>({
      resolveShellPlacements: () => [],
      resolveModePlacements: () => [
        placement({ kind: "mode", modeId: "wrong", placementId: "tools", instanceKey: "default" }, "side", "tools"),
      ],
      resolvePagePlacement: (input: WorkbenchPagePlacementInput) => input.viewId,
      resources: {
        normalize: (resource) => ({ ...resource }),
        toUri: (resource) => `${resource.type}:${resource.id}`,
        fromUri: () => undefined,
      },
      valuesEqual: (left, right) => left === right,
    });
    registerPage(registry, {
      id: "tickets",
      modeId: "project",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "tickets",
        },
        cardinality: "one",
      },
      slots: [],
    });
    expect(() => activatePage(registry, { pageId: "tickets" })).toThrow(/does not match active mode/);
    const state = registry.store.getState();
    expect(state.activeModeId).toBeUndefined();
    expect(state.activePageId).toBeUndefined();
    expect(state.placements).toEqual([]);
  });
});
