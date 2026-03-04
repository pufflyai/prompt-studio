import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listTicketTags as defaultListTicketTags } from "@/features/tickets/api/list-ticket-tags";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";
import { updateTicket as defaultUpdateTicket } from "@/features/tickets/api/update-ticket";
import { uploadTicketFile as defaultUploadTicketFile } from "@/features/tickets/api/upload-ticket-file";
import { listTicketFiles, readTicketAttachment, readTicketFile } from "@/features/tickets/local-ticket";

export const command = "save";
export const describe = "Save local ticket content and files to the database";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("tag", { type: "array", string: true, describe: "Tags to assign" });

type SaveArgs = {
  id: string;
  tag?: string[];
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listTickets: typeof defaultListTickets;
  updateTicket: typeof defaultUpdateTicket;
  uploadTicketFile: typeof defaultUploadTicketFile;
  listTicketTags: typeof defaultListTicketTags;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listTickets: defaultListTickets,
  updateTicket: defaultUpdateTicket,
  uploadTicketFile: defaultUploadTicketFile,
  listTicketTags: defaultListTicketTags,
  log: console.log,
};

const resolveTicketByShorthand = async (deps: Deps, projectId: string, shorthand: string) => {
  const publishedTickets = await deps.listTickets(API_URL, {
    project_id: projectId,
    shorthand,
  });
  if (publishedTickets.length > 0) return publishedTickets[0];

  const draftTickets = await deps.listTickets(API_URL, {
    project_id: projectId,
    shorthand,
    draft: true,
  });
  return draftTickets[0] ?? null;
};

const resolveTagIds = async (deps: Deps, projectId: string, tags: string[] | undefined) => {
  if (!tags || tags.length === 0) return undefined;

  const allTags = await deps.listTicketTags(API_URL, projectId);
  const tagIds: string[] = [];

  for (const name of tags) {
    const found = allTags.find((tag) => tag.name === name);
    if (!found) throw new Error(`Tag not found: ${name}`);
    tagIds.push(found.id);
  }

  return tagIds;
};

const uploadLocalTicketFiles = async (deps: Deps, root: string, shorthand: string, ticketId: string) => {
  const localFiles = listTicketFiles(root, shorthand);

  for (const fileName of localFiles) {
    const data = readTicketAttachment(root, shorthand, fileName);
    await deps.uploadTicketFile(API_URL, ticketId, {
      file_name: fileName,
      content_base64: data.toString("base64"),
    });
  }

  return localFiles.length;
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<SaveArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const projectId = config.project_id;

    const content = readTicketFile(root, argv.id);
    if (content === null) {
      throw new Error(`Local ticket not found: .pstdio/tickets/${argv.id}/ticket.md`);
    }

    const ticket = await resolveTicketByShorthand(deps, projectId, argv.id);
    if (!ticket) throw new Error(`Ticket not found: ${argv.id}`);

    const tagIds = await resolveTagIds(deps, projectId, argv.tag);

    await deps.updateTicket(API_URL, ticket.id, {
      input: content,
      draft: false,
      tag_ids: tagIds,
    });

    const uploadedCount = await uploadLocalTicketFiles(deps, root, argv.id, ticket.id);

    deps.log(`Saved ticket ${argv.id}`);
    if (uploadedCount > 0) deps.log(`Uploaded ${uploadedCount} ticket files`);
  };

export const handler = createHandler();
