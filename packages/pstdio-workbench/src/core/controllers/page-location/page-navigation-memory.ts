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
      const removed = input.resources.toUri(input.resources.normalize(resource));
      const references = (location: PageLocation): boolean =>
        Boolean(
          (location.resource && input.resources.toUri(input.resources.normalize(location.resource)) === removed) ||
            (location.parent && references(location.parent)),
        );
      entries = entries.filter((entry) => !references(entry.location) && !references(entry));
    },
  };
};
