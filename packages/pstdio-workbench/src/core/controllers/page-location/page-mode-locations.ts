import {
  contributionRefId,
  type ModeRef,
  type NavigationTargetPage,
  type PageLocation,
  type PageRef,
  type ResourceRef,
} from "@pstdio/sdk/extensions";
import { pageAllowsMode, resolvePageMode } from "../../registries/pages/page-availability";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import type { NavigationLevelModes } from "./navigation-level";
import { normalizeWorkbenchPageTarget } from "./page-location-normalization";
import { locationUsesResource } from "./page-location-root-level";
import type { ResolvedPageLocation } from "./page-location-types";

// Registered identities also represent host modes. Keeping them qualified prevents bridge requalification.
export const locationModeRef = (id: string): ModeRef => ({ kind: "mode", extensionId: "pstdio", id });

export const resolvePageTargetMode = (
  target: NavigationTargetPage,
  pages: readonly WorkbenchPageContribution[],
  activeModeId?: string,
): NavigationTargetPage => {
  const page = pages.find((page) => page.ref.id === target.page.id && page.ref.extensionId === target.page.extensionId);
  if (!page) throw new Error(`Unknown page: ${target.page.extensionId ?? ""}:page:${target.page.id}`);
  const modeId = resolvePageMode(page, target.mode, activeModeId);
  const parentPage =
    target.parent &&
    pages.find(
      (page) => page.ref.id === target.parent!.page.id && page.ref.extensionId === target.parent!.page.extensionId,
    );
  const parentMode = parentPage && pageAllowsMode(parentPage, modeId) ? modeId : undefined;
  return {
    ...target,
    ...(page.modeIds || target.mode ? { mode: locationModeRef(modeId) } : {}),
    ...(target.parent ? { parent: resolvePageTargetMode(target.parent, pages, parentMode) } : {}),
  };
};

export const resolveLocationMode = (
  resolved: ResolvedPageLocation,
  pages: readonly WorkbenchPageContribution[],
  activeModeId?: string,
) => {
  const page = pages.find((page) => page.id === resolved.pageId);
  if (!page) throw new Error(`Unknown page: ${resolved.pageId}`);
  const modeId = resolvePageMode(page, resolved.location.mode, activeModeId);
  if (!page.modeIds && !resolved.location.mode) return resolved;
  return { ...resolved, location: { ...resolved.location, mode: locationModeRef(modeId) } };
};

export const resolveStartPageLocation = (
  page: PageRef,
  pages: WorkbenchPageContribution[],
  resources: WorkbenchPageResourceCodec,
  activeModeId?: string,
) =>
  normalizeWorkbenchPageTarget({
    target: resolvePageTargetMode({ kind: "page", page }, pages, activeModeId),
    pages,
    resources,
  });

export const createPageModeMemory = (input: {
  pages(): WorkbenchPageContribution[];
  modes: NavigationLevelModes;
  resourceKey(resource: ResourceRef): string;
}) => {
  let locations: Readonly<Record<string, PageLocation>> = {};
  return {
    restore(saved?: Readonly<Record<string, PageLocation>>) {
      locations = saved ?? {};
    },
    forget(resource: ResourceRef) {
      const removed = input.resourceKey(resource);
      locations = Object.fromEntries(
        Object.entries(locations).filter(
          ([, location]) => !locationUsesResource(location, (candidate) => input.resourceKey(candidate) === removed),
        ),
      );
    },
    remember(location: PageLocation) {
      const page = input
        .pages()
        .find((page) => page.ref.id === location.page.id && page.ref.extensionId === location.page.extensionId);
      const modeId = location.mode ? contributionRefId(location.mode) : page?.modeId;
      if (modeId) locations = { ...locations, [modeId]: location };
      return locations;
    },
    target(modeId: string) {
      const mode = input.modes.getMode(modeId);
      if (!mode) throw new Error(`Workbench mode not registered: ${modeId}`);
      if (mode.basePage) {
        const base = input
          .pages()
          .find((page) => page.ref.id === mode.basePage!.id && page.ref.extensionId === mode.basePage!.extensionId);
        if (!base) throw new Error(`Mode "${modeId}" names an unknown base page`);
        resolvePageMode(base, locationModeRef(modeId));
      }
      const saved = locations[modeId];
      if (saved) {
        const page = input
          .pages()
          .find((page) => page.ref.id === saved.page.id && page.ref.extensionId === saved.page.extensionId);
        if (page) {
          try {
            resolvePageMode(page, locationModeRef(modeId));
            return { ...saved, mode: locationModeRef(modeId) };
          } catch {
            /* Declarations can change while a saved location remains. */
          }
        }
      }
      if (!mode.basePage) throw new Error(`Mode "${modeId}" has no allowed remembered page or base page`);
      return { page: mode.basePage, mode: locationModeRef(modeId) };
    },
  };
};
