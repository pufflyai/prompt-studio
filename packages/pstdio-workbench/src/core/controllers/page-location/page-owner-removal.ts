import type { PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageRegistry } from "../../registries/pages/page-registry";
import type { WorkbenchPageResourceCodec } from "../../registries/pages/page-registry-types";
import { normalizeDirectWorkbenchPageLocation } from "./page-location-normalization";
import type { ResolvedPageLocation, WorkbenchPageLocationDiagnostic } from "./page-location-types";

interface PageOwnerRemovalInput<Value> {
  registry: WorkbenchPageRegistry<Value>;
  pages(): readonly WorkbenchPageContribution[];
  resources: WorkbenchPageResourceCodec;
  normalizeStored(location: PageLocation): ResolvedPageLocation;
  start(): ResolvedPageLocation;
  commit(projectId: string, resolved: ResolvedPageLocation, history: "replace", action: string): unknown;
  fail(source: WorkbenchPageLocationDiagnostic["source"], error: unknown): unknown;
}

// Unloading a page contribution can leave the active location without an owner. The nearest page that
// is still registered takes over; otherwise the project falls back to its start page.
export const connectPageOwnerRemoval = <Value>(input: PageOwnerRemovalInput<Value>) =>
  input.registry.store.subscribe((state, previous) => {
    const removedPage = Object.keys(previous.pages).some((pageId) => !state.pages[pageId]);
    if (!removedPage || !state.projectId || state.projectId !== previous.projectId || !previous.location) return;
    try {
      if (state.location) {
        input.normalizeStored(state.location);
        return;
      }
    } catch (error) {
      input.fail("navigation", error);
    }
    try {
      const active = state.activePageId ? state.pages[state.activePageId] : undefined;
      const resolved =
        active && state.location
          ? normalizeDirectWorkbenchPageLocation({
              pageId: active.id,
              pages: input.pages(),
              resources: input.resources,
              ...(state.location.resource ? { resource: state.location.resource } : {}),
              ...(state.location.section ? { section: state.location.section } : {}),
            })
          : input.start();
      input.commit(state.projectId, resolved, "replace", "removePageLocationOwner");
    } catch (error) {
      input.fail("navigation", error);
    }
  });
