import { resourceKey } from "@pstdio/sdk/extensions";
import {
  type WorkbenchModuleContext,
  workbenchResourceIdContextKey,
  workbenchResourceMetadataContextKey,
  workbenchResourceTypeContextKey,
} from "@pstdio/workbench";
import {
  dashboardActiveResourceIdContextKey,
  dashboardActiveResourceKindContextKey,
  dashboardActiveResourceMetadataContextKey,
} from "@/shared/extensions/workbench-extension-contributions";

const isContextPrimitive = (value: unknown) =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";
export const syncActiveResourceContext = (ctx: WorkbenchModuleContext) => {
  const activeMetadataKeys = new Set<string>();
  const clearMetadataContext = () => {
    for (const key of activeMetadataKeys) ctx.context.delete(key);
    activeMetadataKeys.clear();
  };
  const applyResource = () => {
    const resource = ctx.getPrimaryResource();
    clearMetadataContext();
    if (!resource) {
      ctx.context.delete(dashboardActiveResourceKindContextKey);
      ctx.context.delete(dashboardActiveResourceIdContextKey);
      ctx.context.delete(workbenchResourceTypeContextKey);
      ctx.context.delete(workbenchResourceIdContextKey);
      return;
    }
    ctx.context.set(dashboardActiveResourceKindContextKey, resource.type);
    ctx.context.set(dashboardActiveResourceIdContextKey, resource.id ?? resourceKey(resource));
    ctx.context.set(workbenchResourceTypeContextKey, resource.type);
    ctx.context.set(workbenchResourceIdContextKey, resource.id ?? resourceKey(resource));
    for (const [key, value] of Object.entries(resource.metadata ?? {})) {
      if (!isContextPrimitive(value)) continue;
      const dashboardContextKey = dashboardActiveResourceMetadataContextKey(key);
      const workbenchContextKey = workbenchResourceMetadataContextKey(key);
      activeMetadataKeys.add(dashboardContextKey);
      activeMetadataKeys.add(workbenchContextKey);
      ctx.context.set(dashboardContextKey, value);
      ctx.context.set(workbenchContextKey, value);
    }
  };
  applyResource();
  const subscription = ctx.onDidChangePrimaryResource(applyResource);
  return {
    dispose() {
      subscription.dispose();
      clearMetadataContext();
      ctx.context.delete(dashboardActiveResourceKindContextKey);
      ctx.context.delete(dashboardActiveResourceIdContextKey);
      ctx.context.delete(workbenchResourceTypeContextKey);
      ctx.context.delete(workbenchResourceIdContextKey);
    },
  };
};
