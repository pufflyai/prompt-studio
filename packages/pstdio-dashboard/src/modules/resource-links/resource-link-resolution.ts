import {
  isNavigationTarget,
  qualifyNavigationTarget,
  type ResourceRef,
  type ResourceResolution,
  resourceKey,
} from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { toWorkbenchNavigationTarget } from "@pstdio/workbench/extensions";
import type { ResourceLinkCandidate } from "@pstdio/workbench/react";
import { extensionResourceRefSchema } from "pstdio-api-contracts";
import { executeExtensionCommand } from "@/shared/extensions/api";
import { canonicalDashboardResource } from "@/shared/extensions/resource-identity";
import { getCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

export const resolveOwnerBatch = async (input: {
  resources: ResourceRef[];
  resolve(): Promise<unknown>;
  navigate(target: NonNullable<ResourceResolution["target"]>): Promise<void>;
}) => {
  const requested = new Map(input.resources.map((ref) => [resourceKey(ref), ref]));
  let value: unknown;
  try {
    value = await input.resolve();
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const resolved: ResourceLinkCandidate[] = [];
  for (const item of value as ResourceResolution[]) {
    if (!item?.resource) continue;
    const parsed = extensionResourceRefSchema.safeParse(item.resource);
    if (!parsed.success) continue;
    const resource = parsed.data;
    const source = input.resources[0]!;
    const canonical = {
      ...resource,
      extensionId: resource.extensionId ?? source.extensionId,
      projectId: resource.projectId ?? source.projectId,
    };
    const original = requested.get(resourceKey(canonical));
    if (!original) continue;
    const target =
      item.target &&
      isNavigationTarget(item.target) &&
      (item.target.kind === "page" || item.target.kind === "panel" || item.target.kind === "compound")
        ? qualifyNavigationTarget(item.target, source.extensionId!, source.projectId)
        : undefined;
    resolved.push({
      resource: { ...original, label: resource.label, icon: resource.icon, shorthand: resource.shorthand },
      open:
        target && (target.kind === "page" || target.kind === "panel" || target.kind === "compound")
          ? () => input.navigate(target)
          : undefined,
    });
  }
  return resolved;
};

export const resolveLinkedResources = async (
  ctx: WorkbenchModuleContext,
  projectId: string,
  resources: ResourceRef[],
  signal?: AbortSignal,
) => {
  signal?.throwIfAborted();
  const unique = new Map(resources.map((ref) => [resourceKey(ref), ref]));
  const host = new Map(
    ctx.resources.listResources("").map((entry) => {
      const resource = canonicalDashboardResource(entry.resource, projectId);
      return [resourceKey(resource), { ...entry, resource }] as const;
    }),
  );
  const candidates: ResourceLinkCandidate[] = [];
  const batches = new Map<string, { command: string; resources: ResourceRef[] }>();
  const metadata = getCachedDashboardExtensionMetadata(projectId);
  for (const ref of unique.values()) {
    if (ref.extensionId === "pstdio") {
      const entry = host.get(resourceKey(ref));
      if (entry)
        candidates.push({
          resource: entry.resource,
          open: entry.activate
            ? async () => {
                await entry.activate!(entry.resource);
              }
            : undefined,
        });
      continue;
    }
    const kind = metadata?.resourceKinds.find((kind) => kind.extensionId === ref.extensionId && kind.id === ref.type);
    if (!kind?.resolveManyCommand) continue;
    const batch = batches.get(kind.resolveManyCommand) ?? { command: kind.resolveManyCommand, resources: [] };
    batch.resources.push(ref);
    batches.set(kind.resolveManyCommand, batch);
  }
  const owners = await Promise.all(
    [...batches.values()].map((batch) =>
      resolveOwnerBatch({
        resources: batch.resources,
        resolve: async () => {
          signal?.throwIfAborted();
          const response = await executeExtensionCommand(
            projectId,
            batch.command,
            {
              params: { resources: batch.resources },
              source: "dashboard",
            },
            signal,
          );
          return response.outcome.ok ? response.outcome.value : undefined;
        },
        navigate: async (target) => {
          await ctx.navigation.openTarget(toWorkbenchNavigationTarget(target));
        },
      }),
    ),
  );
  return [...candidates, ...owners.flat()];
};
