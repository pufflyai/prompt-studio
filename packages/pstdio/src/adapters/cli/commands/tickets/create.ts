import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { createTicket as defaultCreateTicket } from "@/features/tickets/api/create-ticket";
import { listTicketTags as defaultListTicketTags } from "@/features/tickets/api/list-ticket-tags";
import { writeTicketFile as defaultWriteTicketFile } from "@/features/tickets/local-ticket";

export const command = "create";
export const describe = "Create a ticket directly in the database";

export const builder = (yargs: Argv) =>
  yargs
    .option("content", { type: "string", demandOption: true, describe: "Ticket content (title)" })
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("tag", { type: "array", string: true, describe: "Tags to assign" });

type CreateArgs = {
  content: string;
  "project-id"?: string;
  tag?: string[];
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  createTicket: typeof defaultCreateTicket;
  listTicketTags: typeof defaultListTicketTags;
  writeTicketFile: typeof defaultWriteTicketFile;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  createTicket: defaultCreateTicket,
  listTicketTags: defaultListTicketTags,
  writeTicketFile: defaultWriteTicketFile,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<CreateArgs>) => {
    let projectId = argv["project-id"];

    if (!projectId) {
      const root = deps.findGitRoot(deps.cwd());
      if (!root) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      const config = deps.readConfig(root);
      if (!config) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      projectId = config.project_id;
    }

    let tagIds: string[] | undefined;
    if (argv.tag && argv.tag.length > 0) {
      const allTags = await deps.listTicketTags(API_URL, projectId);
      tagIds = [];
      for (const name of argv.tag) {
        const found = allTags.find((t) => t.name === name);
        if (!found) throw new Error(`Tag not found: ${name}`);
        tagIds.push(found.id);
      }
    }

    const ticket = await deps.createTicket(API_URL, {
      project_id: projectId,
      title: argv.content,
      tag_ids: tagIds,
    });

    const root = deps.findGitRoot(deps.cwd());
    if (root) {
      deps.writeTicketFile(root, ticket.shorthand, `# ${argv.content}\n`);
    }

    deps.log(`Created ticket ${ticket.shorthand}`);
  };

export const handler = createHandler();
