import type { EventBus } from "../sync/event-bus";
import type { ProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";

type SubscribeRepoLinkExtensionRefreshInput = {
  eventBus: Pick<EventBus, "subscribe">;
  invalidate: ProjectExtensionRuntimeCatalog["invalidate"];
  onError?: (error: unknown) => void;
  refreshWatchers: () => Promise<void> | void;
};

// "set" events carry the full link row; "delete" events carry only the link id,
// so a removal cannot name its project and must invalidate every snapshot.
const projectIdOf = (data: unknown) => {
  if (typeof data !== "object" || data === null) return undefined;
  const projectId = (data as { project_id?: unknown }).project_id;
  return typeof projectId === "string" ? projectId : undefined;
};

// A repo can be linked before it holds any extensions, so registering an installed source is not
// enough to start watching its root. Refresh the watchers on every project/repo link change so the
// root watcher attaches to (or detaches from) the repo's `.pstdio/extensions` directory live, and
// invalidate the affected project's snapshot because its repo roots feed runtime normalization.
export const subscribeRepoLinkExtensionRefresh = (input: SubscribeRepoLinkExtensionRefreshInput) =>
  input.eventBus.subscribe((event) => {
    if (event.table !== "project_repos") return;
    input.invalidate({ projectId: projectIdOf(event.data), reason: "repo_link_changed" });
    Promise.resolve(input.refreshWatchers()).catch((error) => input.onError?.(error));
  });
