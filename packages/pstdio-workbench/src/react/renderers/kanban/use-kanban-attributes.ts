import { type AttributeDescriptor, type AttributesSource, isAttributesSource } from "@pstdio/ui/kanban-renderer";
import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

export const useKanbanAttributes = (attributes: AttributeDescriptor[] | AttributesSource) => {
  const source = isAttributesSource(attributes) ? attributes : undefined;
  const fallback = source ? undefined : (attributes as AttributeDescriptor[]);
  const subscribe = source ? source.subscribe : noopSubscribe;
  const getSnapshot = source ? source.getSnapshot : () => fallback!;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
