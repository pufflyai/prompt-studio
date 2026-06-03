import type { ExtensionDefinition } from "@pstdio/sdk/extensions";
import { labHeartbeatCommand } from "./command-refs";

export const labSchedules = {
  heartbeat: {
    title: "Lab heartbeat",
    cron: "* * * * *",
    get command() {
      return labHeartbeatCommand;
    },
  },
} satisfies NonNullable<ExtensionDefinition["schedules"]>;
