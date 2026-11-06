import type { Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { defineCommandGroup } from "../../command-group";

const byId = (yargs: Argv) => yargs.option("id", { type: "string", demandOption: true, describe: "Import job ID" });
export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "imports", describe: "Inspect, pause, and resume bulk session imports" },
  {
    command: "status",
    describe: "Read durable import progress",
    builder: byId,
    handler: async (argv) => console.log(JSON.stringify(await apiClient().sessions.imports.get(String(argv.id)))),
  },
  {
    command: "pause",
    describe: "Pause after the current session is committed",
    builder: byId,
    handler: async (argv) => console.log(JSON.stringify(await apiClient().sessions.imports.pause(String(argv.id)))),
  },
  {
    command: "resume",
    describe: "Continue an interrupted import or retry a completed pass with errors",
    builder: byId,
    handler: async (argv) => console.log(JSON.stringify(await apiClient().sessions.imports.resume(String(argv.id)))),
  },
  {
    command: "errors",
    describe: "Read a page of per-session import failures",
    builder: (yargs: Argv) =>
      byId(yargs).option("offset", { type: "number", default: 0 }).option("limit", { type: "number", default: 100 }),
    handler: async (argv) =>
      console.log(
        JSON.stringify(
          await apiClient().sessions.imports.errors(String(argv.id), {
            offset: Number(argv.offset),
            limit: Number(argv.limit),
          }),
        ),
      ),
  },
);
