import { commandRef, defineExtension } from "@pstdio/sdk/extensions";
import { implementTicketsCommand } from "./src/automations/implement-tickets";
import { refineTicketsCommand } from "./src/automations/refine-tickets";
import { reviewTicketsCommand } from "./src/automations/review-tickets";
import { stuckWorkSweepCommand } from "./src/automations/stuck-work-sweep";
import { sessionStartedHook } from "./src/hooks/session-started";

// Repository-owned automation policy. Planner remains the data and command
// provider; this extension calls only its public command surface.
export default defineExtension({
  commands: {
    "refine-tickets": refineTicketsCommand,
    "implement-tickets": implementTicketsCommand,
    "stuck-work-sweep": stuckWorkSweepCommand,
    "review-tickets": reviewTicketsCommand,
  },

  hooks: {
    sessionStarted: sessionStartedHook,
  },

  schedules: {
    refineTickets: {
      title: "Refine backlog tickets",
      cron: "0 * * * *",
      command: commandRef("pstdio-planner-loops.refine-tickets"),
    },
    implementTickets: {
      title: "Implement ready tickets",
      cron: "*/5 * * * *",
      command: commandRef("pstdio-planner-loops.implement-tickets"),
    },
    stuckWorkSweep: {
      title: "Sweep stuck in-progress tickets",
      cron: "0 * * * *",
      command: commandRef("pstdio-planner-loops.stuck-work-sweep"),
    },
    // Offset from the implementation schedule to reduce same-minute contention.
    reviewTickets: {
      title: "Review in-review tickets",
      cron: "2-59/5 * * * *",
      command: commandRef("pstdio-planner-loops.review-tickets"),
    },
  },
});
