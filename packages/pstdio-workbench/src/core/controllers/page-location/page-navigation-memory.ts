import type { PageLocation, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import { workbenchPageLocationKey, workbenchPageRefKey } from "./page-location-normalization";
import type { RememberedWorkbenchPageLocation } from "./page-location-types";

interface MemoryEntry {
  saved: RememberedWorkbenchPageLocation;
  resourceKeys?: Set<string>;
}

export const createPageNavigationMemory = (input: {
  pages(): readonly WorkbenchPageContribution[];
  resources: WorkbenchPageResourceCodec;
}) => {
  let project: string | undefined;
  const entries = new Set<MemoryEntry>();
  let references: Map<string, Set<MemoryEntry>> | undefined;
  const key = (resource: ResourceRef) => input.resources.toUri(input.resources.normalize(resource));
  const indexEntry = (entry: MemoryEntry, index: Map<string, Set<MemoryEntry>>) => {
    const keys = new Set<string>();
    for (const start of [entry.saved, entry.saved.location]) {
      for (let location: PageLocation | undefined = start; location; location = location.parent) {
        if (location.resource) keys.add(key(location.resource));
      }
    }
    entry.resourceKeys = keys;
    for (const uri of keys) {
      let matches = index.get(uri);
      if (!matches) {
        matches = new Set();
        index.set(uri, matches);
      }
      matches.add(entry);
    }
  };
  const addEntry = (saved: RememberedWorkbenchPageLocation) => {
    const entry: MemoryEntry = { saved };
    entries.add(entry);
    if (references) indexEntry(entry, references);
  };
  const removeEntry = (entry: MemoryEntry) => {
    entries.delete(entry);
    if (!references || !entry.resourceKeys) return;
    for (const uri of entry.resourceKeys) {
      const matches = references.get(uri);
      matches?.delete(entry);
      if (matches?.size === 0) references.delete(uri);
    }
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
      references = undefined;
      entries.clear();
      for (const entry of saved) addEntry(entry);
    },
    find(context: PageLocation) {
      const entry = [...entries]
        .reverse()
        .find(({ saved }) => contextKey(saved) === contextKey(context) && saved.modeId === mode(context));
      return entry?.saved.location;
    },
    remember(location: PageLocation) {
      for (let context: PageLocation | undefined = location; context; context = context.parent) {
        const modeId = mode(context);
        if (!modeId || modeId !== mode(location)) continue;
        const wanted = contextKey(context);
        for (const entry of entries) {
          if (contextKey(entry.saved) === wanted) removeEntry(entry);
        }
        addEntry({
          page: context.page,
          ...(context.resource ? { resource: context.resource } : {}),
          ...(context.parent ? { parent: context.parent } : {}),
          modeId,
          location,
        });
      }
      return Array.from(entries, (entry) => entry.saved);
    },
    consume(location: PageLocation | undefined) {
      if (!location) return;
      const key = locationKey(location);
      for (const entry of entries) {
        if (locationKey(entry.saved.location) === key) removeEntry(entry);
      }
    },
    forgetResource(resource: ResourceRef) {
      if (!references) {
        references = new Map();
        for (const entry of entries) indexEntry(entry, references);
      }
      const matches = references.get(key(resource));
      if (!matches) return false;
      for (const entry of matches) removeEntry(entry);
      return true;
    },
  };
};
