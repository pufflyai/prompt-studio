import { defineHook, projectEvents } from "@pstdio/sdk/extensions";
import { reconcileDependencyBlockers } from "../data/reconcile-dependency-blockers";
import { plannerTicketsChanged } from "../events";

export const dependencyBlockerHooks = [
  defineHook({
    id: "dependency-blockers.tickets-changed",
    event: plannerTicketsChanged,
    async run(ctx) {
      await reconcileDependencyBlockers(ctx);
    },
  }),
  defineHook({
    id: "dependency-blockers.project-opened",
    event: projectEvents.opened,
    async run(ctx) {
      await reconcileDependencyBlockers(ctx);
    },
  }),
];
