import type { NavigationTarget, ResourceRef, workbenchCommands } from "@pstdio/sdk/extensions";
import { resourceKey } from "@pstdio/sdk/extensions";
import { type SessionCompletionStatus, sessionCompletionStatuses } from "@pstdio/ui";

export interface RecentProjectResource {
  id: string;
  title: string;
  icon: string;
  status?: SessionCompletionStatus;
  resource: ResourceRef;
  target: NavigationTarget;
}

export const recentProjectResources = (
  items: NonNullable<typeof workbenchCommands.recentResources.result>,
): RecentProjectResource[] =>
  items.map(({ resource, target }) => {
    const status = resource.metadata?.status;
    return {
      id: resourceKey(resource),
      title: resource.label || resource.shorthand || resource.id,
      icon: resource.icon ?? "file",
      ...(resource.type === "session" && sessionCompletionStatuses.includes(status as SessionCompletionStatus)
        ? { status: status as SessionCompletionStatus }
        : {}),
      resource,
      target,
    };
  });
