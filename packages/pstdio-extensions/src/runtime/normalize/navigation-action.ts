import type { NavigationTarget } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import { isRecord } from "./accumulator";
import { normalizeContributionRef } from "./references";

type NavigationTargetItem = Exclude<NavigationTarget, { kind: "compound" }>;

type NavigationOperation = Extract<NavigationTargetItem, { kind: "page" | "panel" }>;
function normalizeItem(ext: NormalizedExtension, action: NavigationOperation): NavigationOperation;
function normalizeItem(ext: NormalizedExtension, action: NavigationTargetItem): NavigationTargetItem;
function normalizeItem(ext: NormalizedExtension, action: NavigationTargetItem): NavigationTargetItem {
  if (action.kind === "page") {
    const normalizePageTarget = (target: typeof action): typeof action => ({
      ...target,
      page: normalizeContributionRef(ext, target.page),
      ...(target.parent ? { parent: normalizePageTarget(target.parent) } : {}),
    });
    return normalizePageTarget(action);
  }
  if (action.kind === "panel") {
    return {
      ...action,
      panel:
        action.panel.kind === "page-slot"
          ? { ...action.panel, page: normalizeContributionRef(ext, action.panel.page) }
          : normalizeContributionRef(ext, action.panel),
    };
  }
  if (action.kind === "command" && isRecord(action.target.command) && action.target.command.kind === "command") {
    return {
      ...action,
      target: { ...action.target, command: normalizeContributionRef(ext, action.target.command as never) },
    };
  }
  return action;
}

/** Resolves every contribution ref inside a navigation action to an absolute id. */
export const normalizeNavigationAction = (ext: NormalizedExtension, action: NavigationTarget): NavigationTarget =>
  action.kind === "compound"
    ? { ...action, targets: action.targets.map((item) => normalizeItem(ext, item)) }
    : normalizeItem(ext, action);
