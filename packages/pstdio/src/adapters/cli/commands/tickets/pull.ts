import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { getTicket as defaultGetTicket } from "@/features/tickets/api/get-ticket";
import { getTicketFileContent as defaultGetTicketFileContent } from "@/features/tickets/api/get-ticket-file-content";
import { listTicketFiles as defaultListTicketFiles } from "@/features/tickets/api/list-ticket-files";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";
import { writeTicketAttachment, writeTicketFile } from "@/features/tickets/local-ticket";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "@/features/tickets/resolve-ticket-by-shorthand";
import { applyFrontmatter, buildTicketFrontmatter } from "@/features/tickets/ticket-frontmatter";

export const command = "pull";
export const describe = "Pull ticket content and files from the database";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", describe: "Ticket shorthand (e.g. PS-12). Omit to pull all non-archived tickets" })
    .option("force", { type: "boolean", default: false, describe: "Overwrite existing local files" });

type PullArgs = {
  id?: string;
  force: boolean;
};

type Deps = {
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  resolveTicketByShorthand: typeof defaultResolveTicketByShorthand;
  getTicket: typeof defaultGetTicket;
  listTicketFiles: typeof defaultListTicketFiles;
  getTicketFileContent: typeof defaultGetTicketFileContent;
  listTickets: typeof defaultListTickets;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  resolveTicketByShorthand: defaultResolveTicketByShorthand,
  getTicket: defaultGetTicket,
  listTicketFiles: defaultListTicketFiles,
  getTicketFileContent: defaultGetTicketFileContent,
  listTickets: defaultListTickets,
  log: console.log,
};

type PullTicketOpts = {
  deps: Deps;
  root: string;
  ticketId: string;
  shorthand: string;
  statusName: string | null;
  tagNames: string[];
  force: boolean;
};

const resolveParentFrontmatterValue = async (deps: Deps, parentId: string | null) => {
  if (!parentId) return null;
  if (/^[A-Za-z]+-\d+$/.test(parentId)) {
    return parentId;
  }

  const parentTicket = await deps.getTicket(API_URL, parentId);
  if (!parentTicket?.shorthand) {
    return parentId;
  }

  return parentTicket.shorthand;
};

const pullSingleTicket = async ({ deps, root, ticketId, shorthand, statusName, tagNames, force }: PullTicketOpts) => {
  const ticket = await deps.getTicket(API_URL, ticketId);
  if (!ticket) throw new Error(`Ticket not found: ${shorthand}`);
  const parentId = await resolveParentFrontmatterValue(deps, ticket.parent_id);

  const frontmatter = buildTicketFrontmatter({
    shorthand,
    created_at: ticket.created_at,
    draft: ticket.draft,
    status_name: statusName,
    parent_id: parentId,
    user_prompt: ticket.user_prompt ?? null,
    depends_on: ticket.depends_on,
    parallelizable: ticket.parallelizable,
    blocked_reason: ticket.blocked_reason,
    tag_names: tagNames,
  });

  let bodyContent = "";
  if (ticket.file_id) {
    const fileBuffer = await deps.getTicketFileContent(API_URL, ticket.id, ticket.file_id);
    bodyContent = fileBuffer.toString("utf-8");
  }

  const content = applyFrontmatter(frontmatter, bodyContent);
  const filePath = writeTicketFile(root, shorthand, content, force);
  const ticketDir = filePath.replace(/\/ticket\.md$/, "").replace(`${root}/`, "");

  const files = await deps.listTicketFiles(API_URL, ticket.id);
  const attachments = files.filter((f) => f.id !== ticket.file_id);

  for (const file of attachments) {
    const fileContent = await deps.getTicketFileContent(API_URL, ticket.id, file.id);
    writeTicketAttachment(root, shorthand, file.file_name, fileContent, force);
  }

  deps.log(`Pulled ticket ${shorthand} to ${ticketDir}`);
  if (attachments.length > 0) deps.log(`Downloaded ${attachments.length} ticket files`);
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<PullArgs>) => {
    const { root, projectId } = deps.resolveProjectId(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    if (argv.id) {
      const ticketListItem = await deps.resolveTicketByShorthand(API_URL, projectId, argv.id);
      if (!ticketListItem) throw new Error(`Ticket not found: ${argv.id}`);
      await pullSingleTicket({
        deps,
        root,
        ticketId: ticketListItem.id,
        shorthand: argv.id,
        statusName: ticketListItem.status_name,
        tagNames: ticketListItem.tag_names ?? [],
        force: argv.force,
      });
      return;
    }

    const tickets = await deps.listTickets(API_URL, { project_id: projectId, archived: false });

    if (tickets.length === 0) {
      deps.log("No tickets to pull.");
      return;
    }

    for (const ticket of tickets) {
      await pullSingleTicket({
        deps,
        root,
        ticketId: ticket.id,
        shorthand: ticket.shorthand,
        statusName: ticket.status_name,
        tagNames: ticket.tag_names ?? [],
        force: argv.force,
      });
    }

    deps.log(`Pulled ${tickets.length} tickets`);
  };

export const handler = createHandler();
