import { createClient } from "@pstdio/sdk/client";
import type { ResourceAnchorQuery, ResourceRef, ResourceRole } from "@pstdio/sdk/extensions";
import type { Argv } from "yargs";
import { resolveApiUrl } from "@/features/api-url";
import { defineCommandGroup } from "../../command-group";
import { resolveProjectId } from "../notifications/project";

const roles = ["primary", "context", "source", "result"] as const;
export const parseResource = (value: string): ResourceRef => {
  const ref = JSON.parse(value);
  if (!ref || typeof ref.type !== "string" || !ref.type || typeof ref.id !== "string" || !ref.id)
    throw new Error("Resource JSON needs type and id.");
  return ref;
};
const client = () => createClient({ baseUrl: resolveApiUrl() }).resources;
const projectOption = (argv: Argv) =>
  argv.option("project-id", { type: "string", describe: "Project ID; defaults to the current project" });
const endpoints = (argv: Argv) =>
  projectOption(argv)
    .option("from", { type: "string", demandOption: true, describe: "Source ResourceRef JSON" })
    .option("to", { type: "string", demandOption: true, describe: "Target ResourceRef JSON" });

export const { command, describe, subcommands, builder, handler } = defineCommandGroup({
  name: "resources",
  describe: "Link resources in a project",
  subcommands: [
    {
      command: "link",
      describe: "Add or update a directed resource link",
      builder: (argv) => endpoints(argv).option("role", { choices: roles, default: "context" }),
      handler: async (args) => {
        await client().addAnchors(
          resolveProjectId(args["project-id"] as string | undefined),
          parseResource(args.from as string),
          [{ ...parseResource(args.to as string), role: args.role as ResourceRole }],
        );
        console.log(JSON.stringify({ linked: true }));
      },
    },
    {
      command: "unlink",
      describe: "Remove a directed resource link",
      builder: endpoints,
      handler: async (args) => {
        await client().removeAnchors(
          resolveProjectId(args["project-id"] as string | undefined),
          parseResource(args.from as string),
          [parseResource(args.to as string)],
        );
        console.log(JSON.stringify({ removed: true }));
      },
    },
    {
      command: "links",
      describe: "Query outgoing and incoming resource links",
      builder: (argv) =>
        projectOption(argv)
          .option("resource", { type: "string", demandOption: true, describe: "ResourceRef JSON" })
          .option("direction", { choices: ["outgoing", "incoming", "both"], default: "outgoing" })
          .option("role", { choices: roles })
          .option("cursor", { type: "string" })
          .option("limit", { type: "number" }),
      handler: async (args) => {
        const result = await client().listAnchors(resolveProjectId(args["project-id"] as string | undefined), {
          resource: parseResource(args.resource as string),
          direction: args.direction as ResourceAnchorQuery["direction"],
          role: args.role as ResourceRole | undefined,
          cursor: args.cursor as string | undefined,
          limit: args.limit as number | undefined,
        });
        console.log(JSON.stringify(result));
      },
    },
  ],
});
