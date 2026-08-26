import { defineExtension, defineSchedule } from "@pstdio/sdk/extensions";
import { implementTicketsCommand } from "./src/automations/implement-tickets";
import { refineTicketsCommand } from "./src/automations/refine-tickets";
import { reviewTicketsCommand } from "./src/automations/review-tickets";
import { stuckWorkSweepCommand } from "./src/automations/stuck-work-sweep";

// Repository-owned automation policy. Planner remains the data and command
// provider; this extension calls only its public command surface.
export default defineExtension({
  commands: [refineTicketsCommand, implementTicketsCommand, stuckWorkSweepCommand, reviewTicketsCommand],

  schedules: [
    defineSchedule({
      id: "refineTickets",
      title: "Refine backlog tickets",
      schedule: "0 * * * *",
      command: refineTicketsCommand.ref,
    }),
    defineSchedule({
      id: "implementTickets",
      title: "Implement Todo tickets",
      schedule: "*/5 * * * *",
      command: implementTicketsCommand.ref,
    }),
    defineSchedule({
      id: "stuckWorkSweep",
      title: "Sweep stuck in-progress tickets",
      schedule: "0 * * * *",
      command: stuckWorkSweepCommand.ref,
    }),
    // Offset from the implementation schedule to reduce same-minute contention.
    defineSchedule({
      id: "reviewTickets",
      title: "Review in-review tickets",
      schedule: "2-59/5 * * * *",
      command: reviewTicketsCommand.ref,
    }),
  ],
});
