import { defineSchedule } from "@pstdio/sdk/extensions";
import { heartbeatCommand } from "./heartbeat-command";

export const labSchedules = [
  defineSchedule({
    id: "heartbeat",
    title: "Lab heartbeat",
    schedule: "* * * * *",
    command: heartbeatCommand.ref,
  }),
];
