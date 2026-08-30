import { describe, expect, test } from "bun:test";
import type { NavigationTargetPanel, PageLocation, PlacementIdentity, PlacementRef } from "@pstdio/sdk/extensions";
import type { ResolvedOwnedPlacement } from "../../registries/layout/placement-reconciliation";
import {
  createWorkbenchPageRegistry,
  type WorkbenchModePanelTargetInput,
  type WorkbenchModePanelTargetResolution,
  type WorkbenchPagePlacementInput,
} from "../../registries/pages/page-registry";
import {
  createWorkbenchPageLocationController,
  type WorkbenchPageBrowserEntry,
} from "../page-location/page-location-controller";
import { createWorkbenchPanelTargetController } from "./panel-target-controller";

const startRef = { extensionId: "pstdio", kind: "page" as const, id: "start" };
const ticketRef = { extensionId: "acme.planner", kind: "page" as const, id: "ticket" };
const sessionsRef = { extensionId: "pstdio", kind: "page" as const, id: "sessions" };
const projectSessionRef: PlacementRef = {
  extensionId: "pstdio",
  kind: "placement",
  id: "project-session",
};
const sessionsInspectorRef: PlacementRef = {
  extensionId: "pstdio",
  kind: "placement",
  id: "sessions-inspector",
};

const placement = (
  identity: PlacementIdentity,
  region: ResolvedOwnedPlacement<string>["region"],
  value: string,
): ResolvedOwnedPlacement<string> => ({ identity, region, order: 0, value });

const panelKey = (panel: PlacementRef) => `${panel.extensionId}:${panel.id}`;

const resolveModePanelTarget = (
  input: WorkbenchModePanelTargetInput<string>,
): WorkbenchModePanelTargetResolution<string> => {
  const descriptors = {
    "pstdio:project-session": { modeId: "project", placementId: "project-session", resourceKind: "session" },
    "pstdio:sessions-inspector": { modeId: "sessions", placementId: "sessions-inspector", resourceKind: "session" },
  } as const;
  const descriptor = descriptors[panelKey(input.panel) as keyof typeof descriptors];
  if (!descriptor) throw new Error(`Unknown mode panel: ${panelKey(input.panel)}`);
  if (descriptor.modeId !== input.modeId) throw new Error(`Panel owner is not active: ${descriptor.modeId}`);
  if (!input.resource || input.resource.type !== descriptor.resourceKind) {
    throw new Error(`Panel requires a ${descriptor.resourceKind} resource`);
  }
  const identity: PlacementIdentity = {
    kind: "mode",
    modeId: descriptor.modeId,
    placementId: descriptor.placementId,
    instanceKey: `session:${input.resource.id}`,
  };
  const retained = input.current.filter((candidate) => {
    const candidateIdentity = candidate.identity;
    if (candidateIdentity.kind !== "mode" || candidateIdentity.placementId !== descriptor.placementId) return true;
    return input.open === "pin" || candidate.value.includes(":pin");
  });
  return {
    identity,
    placements: [...retained, placement(identity, "side", `session:${input.resource.id}:${input.open ?? "preview"}`)],
  };
};

const createHarness = (modePanelResolver: typeof resolveModePanelTarget = resolveModePanelTarget) => {
  const registry = createWorkbenchPageRegistry<string>({
    resolveShellPlacements: () => [],
    resolveModePlacements: (modeId) => [
      placement({ kind: "mode", modeId, placementId: "shared", instanceKey: "default" }, "side", `mode:${modeId}`),
    ],
    resolveModePanelTarget: modePanelResolver,
    resolvePagePlacement: (input: WorkbenchPagePlacementInput) =>
      `${input.pageId}:${input.slotId}:${input.resource?.id ?? "default"}`,
    resources: {
      normalize: (resource) => ({ ...resource }),
      toUri: (resource) => `pstdio://${resource.type}/${resource.id}`,
      fromUri: () => undefined,
    },
    valuesEqual: (left, right) => left === right,
  });
  registry.registerPage({
    id: "start",
    ref: startRef,
    path: "",
    modeId: "project",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "start" }],
  });
  registry.registerPage({
    id: "ticket",
    ref: ticketRef,
    path: "ticket",
    modeId: "project",
    parentId: "start",
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        binding: { resourceKind: "ticket", viewId: "ticket" },
      },
      {
        id: "emoji",
        role: "auxiliary",
        region: "side",
        binding: { resourceKind: "emoji", viewId: "emoji" },
        cardinality: "many",
      },
      { id: "notes", role: "auxiliary", region: "side", viewId: "notes" },
      {
        id: "inspector",
        role: "auxiliary",
        region: "side",
        binding: { resourceKind: "emoji", viewId: "inspector" },
      },
    ],
  });
  registry.registerPage({
    id: "sessions",
    ref: sessionsRef,
    path: "sessions",
    modeId: "sessions",
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        binding: { resourceKind: "session", viewId: "session" },
      },
    ],
  });

  let browserEntry: WorkbenchPageBrowserEntry = { url: "/projects/p1" };
  const pushes: WorkbenchPageBrowserEntry[] = [];
  const replacements: WorkbenchPageBrowserEntry[] = [];
  const saved = new Map<string, PageLocation>();
  const location = createWorkbenchPageLocationController({
    registry,
    browser: {
      current: () => browserEntry,
      push: (entry) => {
        browserEntry = entry;
        pushes.push(entry);
      },
      replace: (entry) => {
        browserEntry = entry;
        replacements.push(entry);
      },
      onPopState: () => ({ dispose: () => undefined }),
    },
    persistence: {
      load: (projectId) => saved.get(projectId),
      save: (projectId, value) => saved.set(projectId, value),
    },
    startPage: startRef,
  });
  const diagnostics: string[] = [];
  const panels = createWorkbenchPanelTargetController({
    registry,
    reportDiagnostic: (diagnostic) => diagnostics.push(diagnostic.message),
  });
  location.boot("p1");
  location.navigate({
    kind: "page",
    page: ticketRef,
    resource: { type: "ticket", id: "PS-326" },
  });
  return { registry, location, panels, pushes, replacements, saved, diagnostics };
};

const sessionTarget = (panel = projectSessionRef): NavigationTargetPanel => ({
  kind: "panel",
  panel,
  resource: { type: "session", id: "S-1" },
});

describe("workbench panel target controller", () => {
  test("opens an attached mode session without changing page location or browser history", () => {
    const harness = createHarness();
    const before = harness.registry.store.getState().location;
    const pushCount = harness.pushes.length;
    const replaceCount = harness.replacements.length;

    const result = harness.panels.open(sessionTarget());

    expect(result).toMatchObject({ ok: true });
    const state = harness.registry.store.getState();
    expect(state.location).toBe(before);
    expect(harness.pushes).toHaveLength(pushCount);
    expect(harness.replacements).toHaveLength(replaceCount);
    expect(harness.saved.get("p1")).toBe(before);
    expect(state.placements.map((candidate) => candidate.value)).toEqual([
      "ticket:content:PS-326",
      "session:S-1:preview",
      "mode:project",
    ]);
    expect(state.reconciliation.activate[0]?.identity).toEqual({
      kind: "mode",
      modeId: "project",
      placementId: "project-session",
      instanceKey: "session:S-1",
    });
  });

  test("retains an attached session across project pages and removes it on a mode change", () => {
    const harness = createHarness();
    harness.panels.open(sessionTarget());

    harness.location.navigate({ kind: "page", page: startRef });
    expect(harness.registry.store.getState().placements.map((candidate) => candidate.value)).toContain(
      "session:S-1:preview",
    );

    harness.location.navigate({
      kind: "page",
      page: sessionsRef,
      resource: { type: "session", id: "S-1" },
    });
    const state = harness.registry.store.getState();
    expect(state.activeModeId).toBe("sessions");
    expect(state.placements.map((candidate) => candidate.value)).toEqual(["sessions:content:S-1", "mode:sessions"]);
    expect(state.reconciliation.remove.map((candidate) => candidate.value)).toContain("session:S-1:preview");
  });

  test("opens an active page auxiliary slot without changing its primary location", () => {
    const harness = createHarness();
    const before = harness.registry.store.getState().location;

    const result = harness.panels.open({
      kind: "panel",
      panel: { kind: "page-slot", page: ticketRef, id: "emoji" },
      resource: { type: "emoji", id: "wave" },
      open: "pin",
    });

    expect(result).toMatchObject({ ok: true });
    const state = harness.registry.store.getState();
    expect(state.location).toBe(before);
    expect(state.placements.map((candidate) => candidate.value)).toContain("ticket:emoji:wave");
    expect(state.reconciliation.activate[0]?.identity).toEqual({
      kind: "page",
      pageId: "ticket",
      slotId: "emoji",
      instanceKey: "pstdio://emoji/wave",
    });
  });

  test("rejects a panel whose mode or page owner is inactive without a partial commit", () => {
    const harness = createHarness();
    const before = harness.registry.store.getState();

    const modeResult = harness.panels.open(sessionTarget(sessionsInspectorRef));
    const pageResult = harness.panels.open({
      kind: "panel",
      panel: { kind: "page-slot", page: sessionsRef, id: "missing" },
    });

    expect(modeResult).toMatchObject({ ok: false, diagnostic: { code: "panel-target-unresolved" } });
    expect(pageResult).toMatchObject({ ok: false, diagnostic: { code: "panel-target-unresolved" } });
    expect(harness.diagnostics).toHaveLength(2);
    expect(harness.registry.store.getState()).toBe(before);
  });

  test("rejects invalid mode resolver output before committing it", () => {
    const harness = createHarness((input) => ({
      identity: {
        kind: "mode",
        modeId: input.modeId,
        placementId: "project-session",
        instanceKey: "missing",
      },
      placements: input.current,
    }));
    const before = harness.registry.store.getState();

    const result = harness.panels.open(sessionTarget());

    expect(result).toMatchObject({ ok: false, diagnostic: { code: "panel-target-unresolved" } });
    expect(harness.diagnostics).toHaveLength(1);
    expect(harness.registry.store.getState()).toBe(before);
  });

  test("rejects invalid page panel input without changing layout state", () => {
    const harness = createHarness();
    const before = harness.registry.store.getState();
    const panel = (id: string): NavigationTargetPanel["panel"] => ({ kind: "page-slot", page: ticketRef, id });

    const staticResult = harness.panels.open({ kind: "panel", panel: panel("notes"), open: "pin" });
    const oneResult = harness.panels.open({
      kind: "panel",
      panel: panel("inspector"),
      resource: { type: "emoji", id: "wave" },
      open: "pin",
    });
    const resourceResult = harness.panels.open({
      kind: "panel",
      panel: panel("emoji"),
      resource: { type: "ticket", id: "PS-326" },
    });

    expect([staticResult, oneResult, resourceResult].every((result) => !result.ok)).toBe(true);
    expect(harness.diagnostics).toHaveLength(3);
    expect(harness.registry.store.getState()).toBe(before);
  });
});
