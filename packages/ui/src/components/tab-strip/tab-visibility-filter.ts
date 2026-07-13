import type { ReactNode } from "react";
import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import type { VisibilityOverride } from "../tree-list/tree-list-visibility.store";
import { resolveVisibility } from "../tree-list/tree-list-visibility-filter";

export interface TabVisibilityPlacement {
  closable?: boolean;
  hiddenByDefault?: boolean;
  pinned?: boolean;
  title?: string;
  contributionId: string;
}

export const filterVisibleTabs = <T extends TabVisibilityPlacement>(
  placements: T[],
  tabOverrides: Record<string, VisibilityOverride>,
  getKey: (placement: T) => string,
): T[] => {
  let changed = false;
  const next: T[] = [];
  for (const placement of placements) {
    if (placement.pinned === true && placement.hiddenByDefault === true) {
      changed = true;
      continue;
    }
    if (placement.closable === true) {
      next.push(placement);
      continue;
    }
    const effective = resolveVisibility(tabOverrides[getKey(placement)], placement.hiddenByDefault);
    if (effective === "hidden") {
      changed = true;
      continue;
    }
    next.push(placement);
  }
  return changed ? next : placements;
};

export interface TabVisibilityMenuActions {
  onToggleTab: (key: string, hiddenByDefault: boolean) => void;
  onResetAll: () => void;
}

interface BuildTabMenuOptions {
  // Trailing toggle indicator, mirroring the tree menu: eye when shown, eye-off when hidden.
  visibleIcon: ReactNode;
  hiddenIcon: ReactNode;
  resetIcon?: ReactNode;
}

export const buildTabVisibilityMenuActions = <T extends TabVisibilityPlacement>(
  placements: T[],
  tabOverrides: Record<string, VisibilityOverride>,
  actions: TabVisibilityMenuActions,
  getKey: (placement: T) => string,
  options: BuildTabMenuOptions,
  getIcon?: (placement: T) => ReactNode,
): ResourceContextAction[] => {
  const result: ResourceContextAction[] = [];
  let nonCloseableCount = 0;

  for (const placement of placements) {
    if (placement.pinned === true) continue;
    if (placement.closable === true) continue;
    nonCloseableCount += 1;
    const key = getKey(placement);
    const hiddenByDefault = placement.hiddenByDefault === true;
    const effective = resolveVisibility(tabOverrides[key], hiddenByDefault);
    result.push({
      key: `tab:${key}`,
      label: placement.title ?? placement.contributionId,
      icon: getIcon?.(placement),
      onClick: () => actions.onToggleTab(key, hiddenByDefault),
      endContent: effective === "shown" ? options.visibleIcon : options.hiddenIcon,
    });
  }

  if (nonCloseableCount === 0) return result;

  result.push({
    key: "__reset-tabs",
    label: "Reset to default",
    icon: options.resetIcon,
    separatorBefore: true,
    onClick: actions.onResetAll,
  });
  return result;
};
