import type { EventBus } from "../sync/event-bus";

type SubscribeRepoLinkExtensionRefreshInput = {
  eventBus: Pick<EventBus, "subscribe">;
  onError?: (error: unknown) => void;
  refresh: () => Promise<void> | void;
};

// A repo can be linked before it holds any extensions, so registering an installed source is not
// enough to start watching its root. Refresh the runtime on every project/repo link change so the
// root watcher attaches to (or detaches from) the repo's `.pstdio/extensions` directory live.
export const subscribeRepoLinkExtensionRefresh = (input: SubscribeRepoLinkExtensionRefreshInput) =>
  input.eventBus.subscribe((event) => {
    if (event.table !== "project_repos") return;
    Promise.resolve(input.refresh()).catch((error) => input.onError?.(error));
  });
