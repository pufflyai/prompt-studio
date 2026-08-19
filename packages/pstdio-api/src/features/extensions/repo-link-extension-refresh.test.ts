import { describe, expect, test } from "bun:test";
import { EventBus } from "../sync/event-bus";
import { subscribeRepoLinkExtensionRefresh } from "./repo-link-extension-refresh";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

type InvalidateCall = { projectId?: string; sourcePath?: string; reason: string };

describe("subscribeRepoLinkExtensionRefresh", () => {
  test("invalidates the linked project and refreshes watchers on link changes", async () => {
    const eventBus = new EventBus();
    const invalidations: InvalidateCall[] = [];
    let watcherRefreshes = 0;

    const unsubscribe = subscribeRepoLinkExtensionRefresh({
      eventBus,
      invalidate: (input) => invalidations.push(input),
      refreshWatchers: async () => {
        watcherRefreshes += 1;
      },
    });

    eventBus.emit("project_repos", "set", { id: "link-1", project_id: "project-1", repo_id: "repo-1" });
    // A delete event carries no project identity, so everything invalidates.
    eventBus.emit("project_repos", "delete", { id: "link-1" });
    await flush();

    expect(invalidations).toEqual([
      { projectId: "project-1", reason: "repo_link_changed" },
      { projectId: undefined, reason: "repo_link_changed" },
    ]);
    expect(watcherRefreshes).toBe(2);

    unsubscribe();
    eventBus.emit("project_repos", "set", { id: "link-2", project_id: "project-2", repo_id: "repo-2" });
    await flush();

    expect(invalidations).toHaveLength(2);
  });

  test("ignores events for unrelated tables", async () => {
    const eventBus = new EventBus();
    const invalidations: InvalidateCall[] = [];

    subscribeRepoLinkExtensionRefresh({
      eventBus,
      invalidate: (input) => invalidations.push(input),
      refreshWatchers: async () => {},
    });

    eventBus.emit("repos", "set", { id: "repo-1" });
    eventBus.emit("sessions", "set", { id: "session-1" });
    await flush();

    expect(invalidations).toHaveLength(0);
  });
});
