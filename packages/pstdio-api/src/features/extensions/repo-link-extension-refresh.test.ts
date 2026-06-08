import { describe, expect, test } from "bun:test";
import { EventBus } from "../sync/event-bus";
import { subscribeRepoLinkExtensionRefresh } from "./repo-link-extension-refresh";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("subscribeRepoLinkExtensionRefresh", () => {
  test("refreshes when a project repo link is created or removed", async () => {
    const eventBus = new EventBus();
    let refreshes = 0;

    const unsubscribe = subscribeRepoLinkExtensionRefresh({
      eventBus,
      refresh: async () => {
        refreshes += 1;
      },
    });

    eventBus.emit("project_repos", "set", { id: "link-1" });
    eventBus.emit("project_repos", "delete", { id: "link-1" });
    await flush();

    expect(refreshes).toBe(2);

    unsubscribe();
    eventBus.emit("project_repos", "set", { id: "link-2" });
    await flush();

    expect(refreshes).toBe(2);
  });

  test("ignores events for unrelated tables", async () => {
    const eventBus = new EventBus();
    let refreshes = 0;

    subscribeRepoLinkExtensionRefresh({
      eventBus,
      refresh: async () => {
        refreshes += 1;
      },
    });

    eventBus.emit("repos", "set", { id: "repo-1" });
    eventBus.emit("sessions", "set", { id: "session-1" });
    await flush();

    expect(refreshes).toBe(0);
  });
});
