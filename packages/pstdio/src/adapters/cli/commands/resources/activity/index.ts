import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@pstdio/sdk/client";
import type { PublishResourceActivity } from "@pstdio/sdk/extensions";
import type { Argv } from "yargs";
import { resolveApiUrl } from "@/features/api-url";
import { defineCommandGroup } from "../../../command-group";
import { resolveProjectId } from "../../notifications/project";
import { parseResource } from "../index";

const options = (argv: Argv) =>
  argv.option("project-id", { type: "string" }).option("resource", {
    type: "string",
    demandOption: true,
    describe: "ResourceRef JSON including extensionId, type and id",
  });
const target = (args: Record<string, unknown>) => {
  const resource = parseResource(args.resource as string);
  const projectId = resolveProjectId((args["project-id"] as string | undefined) ?? resource.projectId);
  if (resource.projectId && resource.projectId !== projectId) throw new Error("Resource belongs to another project.");
  return { ...resource, projectId };
};
const client = () => createClient({ baseUrl: resolveApiUrl() }).activity;
const output = (value: unknown) => console.log(JSON.stringify(value));
export const { command, describe, builder, handler, subcommands } = defineCommandGroup(
  { name: "activity", describe: "Read discussions and publish resource work outcomes" },
  {
    command: "list",
    describe: "Read a bounded Activity page",
    builder: (argv) => options(argv).option("cursor", { type: "string" }).option("limit", { type: "number" }),
    handler: async (args) =>
      output(
        await client().query({
          resource: target(args),
          cursor: args.cursor as string | undefined,
          limit: args.limit as number | undefined,
        }),
      ),
  },
  {
    command: "read",
    describe: "Read one stable entry",
    builder: (argv) => options(argv).option("id", { type: "string", demandOption: true }),
    handler: async (args) => output(await client().get(target(args), args.id as string)),
  },
  {
    command: "publish",
    describe: "Publish a comment or a structured outcome from JSON",
    builder: (argv) =>
      options(argv).option("file", {
        type: "string",
        demandOption: true,
        describe: "JSON file containing key, kind, body and outcome context",
      }),
    handler: async (args) =>
      output(
        await client().publish(
          target(args),
          JSON.parse(await readFile(args.file as string, "utf8")) as PublishResourceActivity,
          { sourceSessionId: process.env.PSTDIO_SESSION_ID?.trim() || undefined },
        ),
      ),
  },
  {
    command: "resolve",
    describe: "Resolve or reopen a discussion",
    builder: (argv) =>
      options(argv)
        .option("id", { type: "string", demandOption: true })
        .option("resolved", { type: "boolean", default: true }),
    handler: async (args) => output(await client().resolve(target(args), args.id as string, args.resolved as boolean)),
  },
  {
    command: "handoff",
    describe: "Confirm one saved comment's agent handoff",
    builder: (argv) =>
      options(argv).option("id", { type: "string", demandOption: true }).option("workspace-id", { type: "string" }),
    handler: async (args) =>
      output(
        await client().handoff(target(args), args.id as string, {
          workspaceId: args["workspace-id"] as string | undefined,
        }),
      ),
  },
  {
    command: "attach",
    describe: "Attach evidence to a resource",
    builder: (argv) =>
      options(argv)
        .option("file", { type: "string", demandOption: true })
        .option("name", { type: "string" })
        .option("mime-type", { type: "string", default: "application/octet-stream" }),
    handler: async (args) =>
      output(
        await client().attach(target(args), {
          name: (args.name as string | undefined) ?? (args.file as string).split(/[\\/]/).at(-1)!,
          mimeType: args["mime-type"] as string,
          data: await readFile(args.file as string),
        }),
      ),
  },
  {
    command: "download",
    describe: "Download evidence",
    builder: (argv) =>
      options(argv)
        .option("id", { type: "string", demandOption: true })
        .option("file", { type: "string", demandOption: true }),
    handler: async (args) => {
      const result = await client().readAttachment(target(args), args.id as string);
      await writeFile(args.file as string, result.data);
      output(result.attachment);
    },
  },
);
