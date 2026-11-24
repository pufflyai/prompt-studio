import type { PageLocation, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import { workbenchPageLocationKey, workbenchPageRefKey } from "./page-location-normalization";
import type { RememberedWorkbenchPageLocation } from "./page-location-types";

export const createPageNavigationMemory = (input: {
  pages(): readonly WorkbenchPageContribution[];
  resources: WorkbenchPageResourceCodec;
}) => {
  let project: string | undefined;
  let entries: readonly RememberedWorkbenchPageLocation[] = [];
  const key = (resource: ResourceRef) => input.resources.toUri(input.resources.normalize(resource));
  // The entries array is replaced on navigation and project switches. Build the reverse
  // lookup only when sync actually removes a resource from this navigation snapshot.
  const references = new WeakMap<typeof entries, Map<string, Set<RememberedWorkbenchPageLocation>>>();
  const indexReferences = () => {
    const index = new Map<string, Set<RememberedWorkbenchPageLocation>>();
    for (const entry of entries) {
      for (const start of [entry, entry.location]) {
        for (let location: PageLocation | undefined = start; location; location = location.parent) {
          if (!location.resource) continue;
          const uri = key(location.resource);
          let matches = index.get(uri);
          if (!matches) {
            matches = new Set();
            index.set(uri, matches);
          }
          matches.add(entry);
        }
      }
    }
    references.set(entries, index);
    return index;
  };
  const declaration = (context: Pick<PageLocation, "page">) =>
    input.pages().find((page) => workbenchPageRefKey(page.ref) === workbenchPageRefKey(context.page));
  const contextKey = (context: Pick<PageLocation, "page" | "parent" | "resource">) =>
    JSON.stringify([
      workbenchPageRefKey(context.page),
      declaration(context)?.main.kind === "panels" && context.resource
        ? input.resources.toUri(input.resources.normalize(context.resource))
        : null,
      context.parent ? workbenchPageLocationKey(context.parent, input.resources, input.pages()) : null,
    ]);
  const mode = (location: Pick<PageLocation, "page">) =>
    input.pages().find((page) => workbenchPageRefKey(page.ref) === workbenchPageRefKey(location.page))?.modeId;
  const locationKey = (location: PageLocation) => workbenchPageLocationKey(location, input.resources, input.pages());
  return {
    load(projectId: string | undefined, saved: readonly RememberedWorkbenchPageLocation[] = []) {
      if (project === projectId) return;
      project = projectId;
      entries = [...saved];
    },
    find(context: PageLocation) {
      const entry = [...entries]
        .reverse()
        .find((entry) => contextKey(entry) === contextKey(context) && entry.modeId === mode(context));
      return entry?.modeId === mode(context) ? entry?.location : undefined;
    },
    remember(location: PageLocation) {
      for (let context: PageLocation | undefined = location; context; context = context.parent) {
        const modeId = mode(context);
        if (!modeId || modeId !== mode(location)) continue;
        entries = [
          ...entries.filter((entry) => contextKey(entry) !== contextKey(context)),
          {
            page: context.page,
            ...(context.resource ? { resource: context.resource } : {}),
            ...(context.parent ? { parent: context.parent } : {}),
            modeId,
            location,
          },
        ];
      }
      return entries;
    },
    consume(location: PageLocation | undefined) {
      if (!location) return;
      const key = locationKey(location);
      entries = entries.filter((entry) => locationKey(entry.location) !== key);
    },
    forgetResource(resource: ResourceRef) {
      const index = references.get(entries) ?? indexReferences();
      const matches = index.get(key(resource));
      if (!matches) return false;
      entries = entries.filter((entry) => !matches.has(entry));
      return true;
    },
  };
};
