import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import type { ResourceLinkCandidate } from "@pstdio/workbench/react";
import { linkableResource } from "./resource-link-identity";

export const searchLinkResources = async (
  ctx: WorkbenchModuleContext,
  projectId: string,
  query: string,
  signal?: AbortSignal,
) => {
  signal?.throwIfAborted();
  const groups = await ctx.commandPaletteResources.queryProviders({ query, limit: 25, signal });
  signal?.throwIfAborted();
  const entries: ResourceLinkCandidate[] = [
    ...ctx.resources
      .listResources(query)
      .filter((item) =>
        [item.searchText, item.resource.label, item.resource.shorthand, item.resource.id]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
      )
      .slice(0, 25)
      .map((item) => ({
        resource: item.resource,
        description: item.description,
        open: item.activate
          ? async () => {
              await item.activate!(item.resource);
            }
          : undefined,
      })),
    ...groups.flatMap((group) =>
      group.results.slice(0, 25).flatMap((item) =>
        item.resource
          ? [
              {
                resource: { ...item.resource, label: item.label, icon: item.icon },
                description: item.group ?? group.title,
                open: () => item.activate(),
              },
            ]
          : [],
      ),
    ),
  ];
  const unique = new Map<string, ResourceLinkCandidate>();
  for (const entry of entries) {
    const canonical = linkableResource(entry.resource, projectId);
    if (canonical) unique.set(resourceKey(canonical), { ...entry, resource: canonical });
  }
  return [...unique.values()];
};
