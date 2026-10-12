import { contributionRefId, type ModeRef, type NavigationTarget } from "@pstdio/sdk/extensions";
import type { NavigationTarget as CoreNavigationTarget } from "../navigation/navigation-registry";
import type { WorkbenchPageContribution } from "./page-registry-types";

export const pageAllowsMode = (page: WorkbenchPageContribution, modeId: string | undefined) =>
  Boolean(modeId && (page.modeIds ?? [page.modeId]).includes(modeId));

export const resolvePageMode = (page: WorkbenchPageContribution, requested?: ModeRef, activeModeId?: string) => {
  // Legacy navigation selects the singleton mode. New declarations keep the current mode.
  let modeId = page.modeId;
  if (page.modeIds) modeId = activeModeId ?? page.modeId;
  if (requested) modeId = contributionRefId(requested);
  if (!pageAllowsMode(page, modeId))
    throw new Error(`Page "${page.id}" is unavailable in mode "${modeId ?? "none"}". Choose an allowed mode.`);
  return modeId;
};

export const pageTargetAvailable = (
  target: NavigationTarget | CoreNavigationTarget | undefined,
  pages: readonly WorkbenchPageContribution[],
  modeId: string | undefined,
) => {
  if (!target) return true;
  const targets = target.kind === "compound" ? target.targets : [target];
  let proposedMode = modeId;
  try {
    for (const item of targets) {
      if (item.kind !== "page") continue;
      const page = pages.find((page) => page.ref.id === item.page.id && page.ref.extensionId === item.page.extensionId);
      if (!page) return false;
      proposedMode = resolvePageMode(page, item.mode, proposedMode);
    }
    return true;
  } catch {
    return false;
  }
};

export const validatePageModes = (page: WorkbenchPageContribution) => {
  if (!page.modeIds) return;
  if (!page.modeIds.length || new Set(page.modeIds).size !== page.modeIds.length)
    throw new Error(`Page "${page.id}" requires a non-empty, unique modes list`);
  if (!page.modeIds.includes(page.modeId)) throw new Error(`Page "${page.id}" mode must belong to modes`);
};
