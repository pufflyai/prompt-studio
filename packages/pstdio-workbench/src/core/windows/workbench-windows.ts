import type { WorkbenchWidgetPlacement } from "../registries/layout/layout-types";
import type { NavigationTarget, NavigationTargetPage } from "../registries/navigation/navigation-registry";
import { PAGE_MAIN_SLOT_ID } from "../registries/pages/page-main";
import type { WorkbenchCore } from "../workbench-core-types";

// PS-1128 prototype: the workbench owns the tab menu and knows how to describe a tab; the host
// owns windows. A tab moves as a navigation target, so every window opens it the same way an
// agent or a link would.

export interface WorkbenchWindowTarget {
  id: string;
  label: string;
}

export interface WorkbenchWindowHost {
  /** Label of the window this workbench runs in. */
  readonly label: string;
  /** Other open windows of the same project, in the order they were opened. */
  getTargets(): readonly WorkbenchWindowTarget[];
  subscribe(listener: () => void): () => void;
  /**
   * Opens a target in another window, or in a new window when `windowId` is omitted. Resolves
   * once that window opened it. `move` targets return to this window when the other one closes.
   */
  openInWindow(target: NavigationTarget, options?: { windowId?: string; move?: boolean }): Promise<void>;
}

const currentPageTarget = (core: WorkbenchCore): NavigationTargetPage | undefined => {
  const location = core.pages.store.getState().location;
  if (!location) return undefined;
  return {
    kind: "page",
    page: location.page,
    ...(location.resource ? { resource: location.resource } : {}),
    ...(location.params ? { params: location.params } : {}),
  };
};

/** Describes a tab so another window can open it. Returns undefined for tabs that cannot move. */
export const createTabWindowTarget = (
  core: WorkbenchCore,
  placement: WorkbenchWidgetPlacement,
): NavigationTarget | undefined => {
  const identity = placement.placementIdentity;
  if (!identity) return undefined;
  const resource = placement.resource;
  if (identity.kind === "shell") {
    return {
      kind: "panel",
      panel: { kind: "shell-placement", id: identity.placementId },
      ...(resource ? { resource } : {}),
      ...(placement.title ? { title: placement.title } : {}),
      open: "pin",
    };
  }
  if (identity.kind === "mode") {
    const contribution = core.modePlacements
      .listPlacements(identity.modeId)
      .find((candidate) => candidate.id === identity.placementId);
    if (!contribution) return undefined;
    const page = currentPageTarget(core);
    const panel = {
      kind: "panel" as const,
      panel: contribution.ref,
      ...(resource ? { resource } : {}),
      open: "pin" as const,
    };
    return page ? { kind: "compound", targets: [page, panel] } : panel;
  }
  const page = core.pages.store.getState().pages[identity.pageId];
  if (!page) return undefined;
  if (identity.slotId === PAGE_MAIN_SLOT_ID) {
    return { kind: "page", page: page.ref, ...(resource ? { resource } : {}) };
  }
  const location = core.pages.store.getState().location;
  const owner: NavigationTargetPage =
    location && location.page.id === page.ref.id && location.page.extensionId === page.ref.extensionId
      ? (currentPageTarget(core) as NavigationTargetPage)
      : { kind: "page", page: page.ref };
  return {
    kind: "compound",
    targets: [
      owner,
      {
        kind: "panel",
        panel: { kind: "page-slot", page: page.ref, id: identity.slotId },
        ...(resource ? { resource } : {}),
        open: "pin",
      },
    ],
  };
};
