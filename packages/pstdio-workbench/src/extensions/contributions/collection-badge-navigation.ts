import type { CollectionBadgeItem } from "@pstdio/sdk/extensions";
import type { KanbanRendererRow } from "../../core";
import { toWorkbenchNavigationTarget } from "../host/extension-navigation-target";

export const collectionBadgeTarget = (
  row: KanbanRendererRow,
  itemsAttributeId: string,
  itemId: string,
  extensionId: string,
  projectId: string,
) => {
  const items = row.attributes[itemsAttributeId] as CollectionBadgeItem[] | undefined;
  const item = items?.find((item) => item.id === itemId);
  return item?.target ? toWorkbenchNavigationTarget(item.target, { extensionId, projectId }) : undefined;
};
