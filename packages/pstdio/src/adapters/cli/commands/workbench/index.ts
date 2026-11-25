import { createRequest } from "@pstdio/sdk/client";
import { resolveApiUrl } from "@/features/api-url";
import { resolveProjectId } from "@/features/projects/resolve-project-id";
import { resolveCliSessionId } from "@/features/sessions/resolve-cli-session-id";
import { defineCommandGroup } from "../../command-group";

export const { command, describe, builder, handler, subcommands } = defineCommandGroup(
  { name: "workbench", describe: "Read the workbench attached to an agent request" },
  {
    command: "context",
    describe: "Read the current page, panels and selection, or the original send-time selection",
    builder: (argv) =>
      argv
        .option("json", { type: "boolean", describe: "Print compact JSON" })
        .option("at-send", {
          type: "boolean",
          describe: "Read the workbench snapshot captured when the request was sent",
        })
        .option("project-id", { type: "string", describe: "Use a specific project scope" }),
    handler: async (args) => {
      const print = (result: unknown) => console.log(JSON.stringify(result, null, args.json ? undefined : 2));
      const session = resolveCliSessionId({ env: process.env });
      if (!session) return print({ status: "unavailable", reason: "no-agent-request" });
      const scopedProject = args["project-id"] as string | undefined;
      let projectId: string | undefined;
      try {
        projectId = scopedProject ?? process.env.PSTDIO_PROJECT_ID?.trim() ?? resolveProjectId(process.cwd()).projectId;
      } catch {
        return print({ status: "unavailable", reason: "no-project-scope" });
      }
      const route = `/v1/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(session)}/workbench-context`;
      const request = createRequest({ baseUrl: resolveApiUrl(), token: process.env.PSTDIO_API_TOKEN });
      print(await request(`${route}?atSend=${Boolean(args["at-send"])}`));
    },
  },
);
