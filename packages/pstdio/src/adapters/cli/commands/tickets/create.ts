import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { createTicket as defaultCreateTicket } from "@/features/tickets/api/create-ticket";
import { listTicketStatuses as defaultListTicketStatuses } from "@/features/tickets/api/list-ticket-statuses";
import { listTicketTags as defaultListTicketTags } from "@/features/tickets/api/list-ticket-tags";
import { writeTicketFile as defaultWriteTicketFile } from "@/features/tickets/local-ticket";

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
  readConfig: typeof readConfig;
  createTicket: typeof defaultCreateTicket;
  listTicketStatuses: typeof defaultListTicketStatuses;
  listTicketTags: typeof defaultListTicketTags;
  writeTicketFile: typeof defaultWriteTicketFile;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  createTicket: defaultCreateTicket,
  listTicketStatuses: defaultListTicketStatuses,
  listTicketTags: defaultListTicketTags,
  writeTicketFile: defaultWriteTicketFile,
  log: console.log,
};

const resolveProjectId = (deps: Deps, explicitId?: string) => {
  if (explicitId) return explicitId;
  const root = deps.findGitRoot(deps.cwd());
  if (!root) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
  const config = deps.readConfig(root);
  if (!config) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
  return config.project_id;
};

const resolveStatusId = async (deps: Deps, projectId: string, statusName: string) => {
  const statuses = await deps.listTicketStatuses(API_URL, projectId);
  const found = statuses.find((s) => s.name === statusName);
  if (!found) throw new Error(`Status not found: ${statusName}`);
  return found.id;
};

const resolveTagIds = async (deps: Deps, projectId: string, tagNames: string[]) => {
  const allTags = await deps.listTicketTags(API_URL, projectId);
  return tagNames.map((name) => {
    const found = allTags.find((t) => t.name === name);
    if (!found) throw new Error(`Tag not found: ${name}`);
    return found.id;
  });
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<CreateArgs>) => {
    const projectId = resolveProjectId(deps, argv["project-id"]);
    const tagIds = argv.tag?.length ? await resolveTagIds(deps, projectId, argv.tag) : undefined;
    const statusId = argv.status ? await resolveStatusId(deps, projectId, argv.status) : undefined;

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
