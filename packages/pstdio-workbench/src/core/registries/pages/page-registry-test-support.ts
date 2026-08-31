import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchPlacementStatePersistence } from "../layout/owned-placement-state";
import {
  createWorkbenchPageRegistry,
  type WorkbenchPageContribution,
  type WorkbenchPageOpenInput,
  type WorkbenchPagePlacementInput,
} from "./page-registry";
import { getWorkbenchPageRegistryInternals } from "./page-registry-internals";

export const pageIdentity = (pageId: string, slotId: string, instanceKey: string): PlacementIdentity => ({
  kind: "page",
  pageId,
  slotId,
  instanceKey,
});

export const createRegistry = (placementStatePersistence?: WorkbenchPlacementStatePersistence) =>
  createWorkbenchPageRegistry<WorkbenchPagePlacementInput>({
    resolveShellPlacements: () => [],
    resolveModePlacements: () => [],
    resolveModePanelTarget: () => {
      throw new Error("No mode panels are registered in this test");
    },
    resolvePagePlacement: (input) => input,
    resources: {
      normalize: (resource) => ({ ...resource }),
      toUri: (resource) => `${resource.type}:${resource.id}`,
      fromUri: () => undefined,
    },
    valuesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    ...(placementStatePersistence ? { placementStatePersistence } : {}),
  });

type PageInput = Omit<WorkbenchPageContribution, "ref" | "title" | "path">;

export const registerPage = (registry: ReturnType<typeof createRegistry>, page: PageInput) =>
  registry.registerPage({
    ...page,
    ref: { extensionId: "pstdio.test", kind: "page", id: page.id },
    title: page.id,
    path: page.id,
  });

export const activatePage = (
  registry: ReturnType<typeof createRegistry>,
  target: WorkbenchPageOpenInput,
  pageStates = registry.store.getState().pageStates,
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

export const closePlacement = (registry: ReturnType<typeof createRegistry>, identity: PlacementIdentity) => {
  const result = getWorkbenchPageRegistryInternals(registry).resolveClosePlacement(identity);
  if (result.kind === "parent") {
    activatePage(registry, { pageId: result.parentId }, result.pageStates);
    return;
  }
  activatePage(registry, result.target, result.pageStates);
};

export const activePagePlacements = (registry: ReturnType<typeof createRegistry>, slotId: string) =>
  registry.store
    .getState()
    .placements.filter((candidate) => candidate.identity.kind === "page" && candidate.identity.slotId === slotId);
