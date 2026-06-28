import { commandRef, defineExtension } from "@pstdio/sdk/extensions";
import {
  implementationTickCommand,
  onSessionStartedHook,
  onTicketStatusChangedHook,
  refinementSweepCommand,
  reviewTickCommand,
  stuckWorkSweepCommand,
} from "./src/commands";
import { automationsSettings } from "./src/settings";

const refinementSweepRef = commandRef("pstdio-loops.refinement.sweep");
const implementationTickRef = commandRef("pstdio-loops.implementation.tick");
const implementationSweepRef = commandRef("pstdio-loops.implementation.sweepStuck");
const reviewTickRef = commandRef("pstdio-loops.review.tick");

export default defineExtension({
  settings: automationsSettings,

  commands: {
    "refinement.sweep": refinementSweepCommand,
    "implementation.tick": implementationTickCommand,
    "implementation.sweepStuck": stuckWorkSweepCommand,
    "review.tick": reviewTickCommand,
  },

  hooks: {
    onSessionStarted: onSessionStartedHook,
    onTicketStatusChanged: onTicketStatusChangedHook,
  },

  schedules: {
    refinementSweep: {
      title: "Planner refinement sweep",
      cron: "0 * * * *",
      command: refinementSweepRef,
    },
    implementationTick: {
      title: "Planner implementation tick",
      cron: "*/5 * * * *",
      command: implementationTickRef,
    },
    implementationSweepStuck: {
      title: "Planner stuck-work sweep",
      cron: "0 * * * *",
      command: implementationSweepRef,
    },
    reviewTick: {
      title: "Planner review tick",
      // Offset from implementation/refinement so a single minute does not run
      // every cron at once.
      cron: "2-59/5 * * * *",
      command: reviewTickRef,
    },
  },
});
