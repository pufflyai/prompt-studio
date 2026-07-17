import type { WorkbenchMenuItem } from "../menus/menu-items";

export type WorkbenchHeaderOverflowItem = WorkbenchMenuItem & { separatorBefore?: boolean };

export interface WorkbenchHeaderActionGroups {
  inlineItems: WorkbenchMenuItem[];
  overflowItems: WorkbenchHeaderOverflowItem[];
}

const isKernelAction = (item: WorkbenchMenuItem) => item.group === "kernel";

const isOverflowAction = (item: WorkbenchMenuItem) => item.group === "overflow" || isKernelAction(item);

const isResourceAction = (item: WorkbenchMenuItem) =>
  item.group === "primary" || item.group === "overflow" || item.group === "kernel";

const withLeadingSeparator = (items: WorkbenchMenuItem[], enabled: boolean) => {
  if (!enabled || items.length === 0) return items;

  const [first, ...rest] = items;
  if (!first) return rest;

  return [{ ...first, separatorBefore: true as const }, ...rest];
};

const resolveOverflowItems = (items: WorkbenchMenuItem[]) => {
  const regularItems = items.filter((item) => !isKernelAction(item));
  const kernelItems = items.filter(isKernelAction);

  return [...regularItems, ...withLeadingSeparator(kernelItems, regularItems.length > 0)];
};

export const resolveWorkbenchHeaderActionGroups = (items: WorkbenchMenuItem[]) =>
  ({
    inlineItems: items.filter((item) => !isOverflowAction(item)),
    overflowItems: resolveOverflowItems(items.filter(isOverflowAction)),
  }) satisfies WorkbenchHeaderActionGroups;

export const resolveWorkbenchResourceActionItems = (items: WorkbenchMenuItem[]) => {
  const { inlineItems, overflowItems } = resolveWorkbenchHeaderActionGroups(items.filter(isResourceAction));
  return [...inlineItems, ...withLeadingSeparator(overflowItems, inlineItems.length > 0)];
};

export const resolveWorkbenchAuxiliaryHeaderActionItems = (items: WorkbenchMenuItem[]) =>
  items.filter((item) => !isResourceAction(item));

export const resolveWorkbenchHeaderOverflowLabel = (items: WorkbenchMenuItem[], fallback = "More header actions") =>
  items.find((item) => item.overflowLabel)?.overflowLabel ?? fallback;
