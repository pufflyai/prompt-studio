import { defineHook, projectEvents } from "@pstdio/sdk/extensions";
import { reconcileDependencyBlockers } from "../data/reconcile-dependency-blockers";

// Saves already store dependency waiting as links, and reads derive the blocker, so stale
// dependency-only text needs no per-change scan. Opening a project cleans up older tickets once.
export const dependencyBlockerHooks = [
  defineHook({
    id: "dependency-blockers.project-opened",
    event: projectEvents.opened,
    async run(ctx) {
      await reconcileDependencyBlockers(ctx);
    },
  }),
];
