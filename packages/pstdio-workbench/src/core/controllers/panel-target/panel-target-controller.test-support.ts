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

export const startRef = { extensionId: "pstdio", kind: "page" as const, id: "start" };
export const ticketRef = { extensionId: "acme.planner", kind: "page" as const, id: "ticket" };
export const sessionsRef = { extensionId: "pstdio", kind: "page" as const, id: "sessions" };
const projectSessionRef: PlacementRef = {
  extensionId: "pstdio",
  kind: "placement",
  id: "project-session",
};
export const sessionsInspectorRef: PlacementRef = {
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

export const createHarness = (modePanelResolver: typeof resolveModePanelTarget = resolveModePanelTarget) => {
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
    title: "Start",
    path: "",
    modeId: "project",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "start" }],
  });
  registry.registerPage({
    id: "ticket",
    ref: ticketRef,
    title: "Ticket",
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
    title: "Sessions",
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

export const sessionTarget = (panel = projectSessionRef): NavigationTargetPanel => ({
  kind: "panel",
  panel,
  resource: { type: "session", id: "S-1" },
});
