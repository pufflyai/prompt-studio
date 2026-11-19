import { createClient } from "@pstdio/sdk/client";
import { resolveApiUrl } from "@/features/api-url";
import { defineCommandGroup } from "../../command-group";
import { resolveProjectId } from "../notifications/project";
import { parseResource } from "./index";

const api = () => createClient({ baseUrl: resolveApiUrl() }).resourceChanges;
export const { command, describe, builder, handler, subcommands } = defineCommandGroup(
  { name: "changes", describe: "Read resource changes and acknowledge observed content" },
  ...(["query", "read"] as const).map((operation) => ({
    command: operation,
    describe:
      operation === "read" ? "Read content with its observation receipt" : "Check a resource for unseen changes",
    builder: (argv: import("yargs").Argv) => argv.option("resource", { type: "string", demandOption: true }),
    handler: async (args: Record<string, unknown>) => {
      const ref = parseResource(args.resource as string);
      const project = resolveProjectId(ref.projectId);
      console.log(
        JSON.stringify(operation === "read" ? await api().read(project, ref) : await api().query(project, [ref])),
      );
    },
  })),
  {
    command: "acknowledge",
    describe: "Acknowledge exactly the content read",
    builder: (argv) =>
      argv.option("receipt", { type: "string", demandOption: true }).option("project-id", { type: "string" }),
    handler: async (args) =>
      console.log(
        JSON.stringify(
          await api().acknowledge(resolveProjectId(args["project-id"] as string | undefined), args.receipt as string),
        ),
      ),
  },
);
