import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot } from "@/features/config/config";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { createTicket as defaultCreateTicket } from "@/features/tickets/api/create-ticket";
import { writeTicketFile as defaultWriteTicketFile } from "@/features/tickets/local-ticket";
import { resolveStatusId as defaultResolveStatusId } from "@/features/tickets/resolve-status-id";
import { resolveTagIds as defaultResolveTagIds } from "@/features/tickets/resolve-tag-ids";

export const command = "create";
export const describe = "Create a ticket directly in the database";

export const builder = (yargs: Argv) =>
  yargs
    .option("content", { type: "string", demandOption: true, describe: "Ticket content (title)" })
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("status", { type: "string", describe: "Status name to assign" })
    .option("tag", { type: "array", string: true, describe: "Tags to assign" });

type CreateArgs = {
  content: string;
  "project-id"?: string;
  status?: string;
  tag?: string[];
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  resolveProjectId: typeof defaultResolveProjectId;
  createTicket: typeof defaultCreateTicket;
  resolveStatusId: typeof defaultResolveStatusId;
  resolveTagIds: typeof defaultResolveTagIds;
  writeTicketFile: typeof defaultWriteTicketFile;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  resolveProjectId: defaultResolveProjectId,
  createTicket: defaultCreateTicket,
  resolveStatusId: defaultResolveStatusId,
  resolveTagIds: defaultResolveTagIds,
  writeTicketFile: defaultWriteTicketFile,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<CreateArgs>) => {
    const { projectId } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);
    const tagIds = argv.tag?.length ? await deps.resolveTagIds(API_URL, projectId, argv.tag) : undefined;
    const statusId = argv.status ? await deps.resolveStatusId(API_URL, projectId, argv.status) : undefined;

    const ticket = await deps.createTicket(API_URL, {
      project_id: projectId,
      title: argv.content,
      tag_ids: tagIds,
      status_id: statusId,
    });

    const root = deps.findGitRoot(deps.cwd());
    if (root) {
      deps.writeTicketFile(root, ticket.shorthand, `# ${argv.content}\n`);
    }

    deps.log(`Created ticket ${ticket.shorthand}`);
  };

export const handler = createHandler();
