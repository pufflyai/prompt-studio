import { describe, expect, test } from "bun:test";
import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import {
  createWorkbenchPageRegistry,
  type WorkbenchPagePlacementInput,
  type WorkbenchPageRegistry,
} from "./page-registry";

const placement = (
  identity: PlacementIdentity,
  region: ResolvedOwnedPlacement<string>["region"],
  value: string,
): ResolvedOwnedPlacement<string> => ({ identity, region, order: 0, value });

const createRegistry = () =>
  createWorkbenchPageRegistry({
    resolveShellPlacements: () => [
      placement({ kind: "shell", placementId: "project-header", instanceKey: "default" }, "sidenav-header", "header"),
    ],
    resolveModePlacements: (modeId) => [
      placement({ kind: "mode", modeId, placementId: "shared", instanceKey: "default" }, "side", "shared"),
    ],
    resolvePagePlacement: (input: WorkbenchPagePlacementInput) =>
      `${input.viewId}:${input.resource?.id ?? "default"}:${input.section?.anchors[0]?.id ?? ""}`,
    resourceKey: (resource) => `${resource.type}:${resource.id}`,
    valuesEqual: (left, right) => left === right,
  });

const registerPages = (registry: WorkbenchPageRegistry<string>) => {
  registry.registerPage({
    id: "tickets",
    modeId: "project",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "tickets-view" }],
  });
  registry.registerPage({
    id: "ticket",
    modeId: "project",
    parentId: "tickets",
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        cardinality: "many",
        closable: true,
        binding: { resourceKind: "ticket", viewId: "detail" },
      },
      { id: "emoji", role: "auxiliary", region: "side", viewId: "shared", defaultOpen: true },
    ],
  });
  registry.registerPage({
    id: "sessions",
    modeId: "sessions",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "sessions-view" }],
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
      "shell:project-header:default",
    ]);
  });

  test("composes shell, mode, and page owners additively without sharing view instances", () => {
    const registry = createRegistry();
    registerPages(registry);

    registry.activatePage({ pageId: "ticket", resource: { type: "ticket", id: "PS-326" } });

    const state = registry.store.getState();
    expect(state.activeModeId).toBe("project");
    expect(state.activePageId).toBe("ticket");
    expect(state.placements.map((candidate) => identityKey(candidate.identity))).toEqual([
      "shell:project-header:default",
      "page:ticket:content:ticket:PS-326",
      "mode:project:shared:default",
      "page:ticket:emoji:default",
    ]);
    expect(state.placements.filter((candidate) => candidate.value.startsWith("shared"))).toHaveLength(2);
  });

  test("keeps mode placements when only the page changes", () => {
    const registry = createRegistry();
    registerPages(registry);
    registry.activatePage({ pageId: "ticket", resource: { type: "ticket", id: "PS-326" } });

    registry.activatePage({ pageId: "tickets" });

    const reconciliation = registry.store.getState().reconciliation;
    expect(reconciliation.retain.map((candidate) => identityKey(candidate.identity))).toContain(
      "mode:project:shared:default",
    );
    expect(reconciliation.remove.map((candidate) => identityKey(candidate.identity))).toEqual([
      "page:ticket:content:ticket:PS-326",
      "page:ticket:emoji:default",
    ]);
    expect(reconciliation.add.map((candidate) => identityKey(candidate.identity))).toEqual([
      "page:tickets:content:default",
    ]);
  });

  test("publishes a mode and page change as one complete store transition", () => {
    const registry = createRegistry();
    registerPages(registry);
    registry.activatePage({ pageId: "ticket", resource: { type: "ticket", id: "PS-326" } });
    const observed: Array<{ modeId?: string; pageId?: string; owners: string[] }> = [];
    const unsubscribe = registry.store.subscribe((state) => {
      observed.push({
        modeId: state.activeModeId,
        pageId: state.activePageId,
        owners: state.placements.map((candidate) => candidate.identity.kind),
      });
    });

    registry.activatePage({ pageId: "sessions" });
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
    ).toEqual(["page:sessions:content:default"]);
  });

  test("rejects mode placements owned by a different mode before changing state", () => {
    const registry = createWorkbenchPageRegistry({
      resolveShellPlacements: () => [],
      resolveModePlacements: () => [
        placement({ kind: "mode", modeId: "wrong", placementId: "tools", instanceKey: "default" }, "side", "tools"),
      ],
      resolvePagePlacement: (input: WorkbenchPagePlacementInput) => input.viewId,
      resourceKey: (resource) => `${resource.type}:${resource.id}`,
      valuesEqual: (left, right) => left === right,
    });
    registry.registerPage({
      id: "tickets",
      modeId: "project",
      slots: [{ id: "content", role: "primary", region: "main", viewId: "tickets" }],
    });

    expect(() => registry.activatePage({ pageId: "tickets" })).toThrow(/does not match active mode/);
    const state = registry.store.getState();
    expect(state.activeModeId).toBeUndefined();
    expect(state.activePageId).toBeUndefined();
    expect(state.placements).toEqual([]);
  });
});
