import type { ResourceContextAction } from "@pstdio/ui";

export interface SidenavContextActionsUpdate {
  ownerId: string;
  actions: ResourceContextAction[];
}

export type SidenavContextActionsChange = (update: SidenavContextActionsUpdate) => void;

export const updateSidenavContextActions = (
  current: Record<string, ResourceContextAction[]>,
  update: SidenavContextActionsUpdate,
) => {
  if (update.actions.length) return { ...current, [update.ownerId]: update.actions };
  const { [update.ownerId]: _removed, ...remaining } = current;
  return remaining;
};
