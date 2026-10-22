import { defineHook, projectEvents, sessionEvents } from "@pstdio/sdk/extensions";
import { refreshAttemptTickets } from "../data/attempt-rollup";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { plannerTicketsChanged } from "../events";

export const attemptStatusSessionHooks = [
  sessionEvents.started,
  sessionEvents.resumed,
  sessionEvents.awaitingInput,
  sessionEvents.completed,
].map((event) =>
  defineHook({
    id: `attempt-status.${event.id.split(".").at(-1)!.toLowerCase()}`,
    event,
    async run(ctx, { sessionId }) {
      if ((await readAutoBuildSupervisor(ctx)).sessionId === sessionId) return;
      await refreshAttemptTickets(ctx, sessionId);
    },
  }),
);
export const attemptStatusTicketsChangedHook = defineHook({
  id: "attempt-status.tickets-changed",
  event: plannerTicketsChanged,
  async run(ctx, { ticketId }) {
    await refreshAttemptTickets(ctx, undefined, ticketId);
  },
});
export const attemptStatusProjectOpenedHook = defineHook({
  id: "attempt-status.project-opened",
  event: projectEvents.opened,
  async run(ctx) {
    await refreshAttemptTickets(ctx);
  },
});
export const attemptStatusHooks = [
  ...attemptStatusSessionHooks,
  attemptStatusTicketsChangedHook,
  attemptStatusProjectOpenedHook,
];
