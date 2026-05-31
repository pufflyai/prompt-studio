import type { WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import {
  dashboardActiveResourceIdContextKey,
  dashboardActiveResourceKindContextKey,
  dashboardActiveResourceMetadataContextKey,
} from "@/shared/extensions/workbench-extension-contributions";

const readActivePlacement = (ctx: WorkbenchModuleContributionContext) => {
  const { activeWidgetId, areas } = ctx.layout.getLayout();
  if (!activeWidgetId) return undefined;

  for (const area of Object.values(areas)) {
    const placement = area.widgets.find((candidate) => candidate.widgetId === activeWidgetId);
    if (placement) return placement;
  }

  return undefined;
};

export const readActiveResource = (ctx: WorkbenchModuleContributionContext) => readActivePlacement(ctx)?.resource;

const isContextPrimitive = (value: unknown) =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

export const syncActiveResourceContext = (ctx: WorkbenchModuleContributionContext) => {
  const activeMetadataKeys = new Set<string>();

  const clearMetadataContext = () => {
    for (const key of activeMetadataKeys) ctx.context.delete(key);
    activeMetadataKeys.clear();
  };

  const applyResource = () => {
    const resource = readActiveResource(ctx);

    clearMetadataContext();
    if (!resource) {
      ctx.context.delete(dashboardActiveResourceKindContextKey);
      ctx.context.delete(dashboardActiveResourceIdContextKey);
      return;
    }

    ctx.context.set(dashboardActiveResourceKindContextKey, resource.kind);
    ctx.context.set(dashboardActiveResourceIdContextKey, resource.id ?? resource.uri);

    for (const [key, value] of Object.entries(resource.metadata ?? {})) {
      if (!isContextPrimitive(value)) continue;
      const contextKey = dashboardActiveResourceMetadataContextKey(key);
      activeMetadataKeys.add(contextKey);
      ctx.context.set(contextKey, value);
    }
  };

  const unsubscribe = ctx.layout.store.subscribeSelector(
    (state) => {
      const activeWidgetId = state.layout.activeWidgetId;
      if (!activeWidgetId) return "";

      for (const area of Object.values(state.layout.areas)) {
        const placement = area.widgets.find((candidate) => candidate.widgetId === activeWidgetId);
        if (placement) return `${placement.widgetId}:${placement.resourceUri ?? ""}`;
      }

      return "";
    },
    applyResource,
    { fireImmediately: true },
  );

  return {
    dispose() {
      unsubscribe();
      clearMetadataContext();
      ctx.context.delete(dashboardActiveResourceKindContextKey);
      ctx.context.delete(dashboardActiveResourceIdContextKey);
    },
  };
};
