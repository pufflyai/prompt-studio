import { existsSync } from "node:fs";
import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { getTicket as defaultGetTicket } from "@/features/tickets/api/get-ticket";
import { getTicketFileContent as defaultGetTicketFileContent } from "@/features/tickets/api/get-ticket-file-content";
import { listTicketFiles as defaultListTicketFiles } from "@/features/tickets/api/list-ticket-files";
import { ticketFilePath, writeTicketAttachment, writeTicketFile } from "@/features/tickets/local-ticket";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "@/features/tickets/resolve-ticket-by-shorthand";

export const command = "pull";
export const describe = "Pull ticket content and files from the database";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("force", { type: "boolean", default: false, describe: "Overwrite existing local files" });

type PullArgs = {
  id: string;
  force: boolean;
};

type Deps = {
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  resolveTicketByShorthand: typeof defaultResolveTicketByShorthand;
  getTicket: typeof defaultGetTicket;
  listTicketFiles: typeof defaultListTicketFiles;
  getTicketFileContent: typeof defaultGetTicketFileContent;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  resolveTicketByShorthand: defaultResolveTicketByShorthand,
  getTicket: defaultGetTicket,
  listTicketFiles: defaultListTicketFiles,
  getTicketFileContent: defaultGetTicketFileContent,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<PullArgs>) => {
    const { root, projectId } = deps.resolveProjectId(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const ticketListItem = await deps.resolveTicketByShorthand(API_URL, projectId, argv.id);
    if (!ticketListItem) throw new Error(`Ticket not found: ${argv.id}`);

    const ticket = await deps.getTicket(API_URL, ticketListItem.id);
    if (!ticket) throw new Error(`Ticket not found: ${argv.id}`);

    const localTicketFile = ticketFilePath(root, argv.id);
    if (!argv.force && localTicketFile && existsSync(localTicketFile)) {
      throw new Error(`Local ticket already exists: ${argv.id}. Use --force to overwrite.`);
    }

    const filePath = writeTicketFile(root, argv.id, ticket.input ?? "");
    const ticketDir = filePath.replace(/\/ticket\.md$/, "").replace(`${root}/`, "");

    const files = await deps.listTicketFiles(API_URL, ticket.id);

    for (const file of files) {
      const content = await deps.getTicketFileContent(API_URL, ticket.id, file.id);
      writeTicketAttachment(root, argv.id, file.file_name, content, argv.force);
    }

    deps.log(`Pulled ticket ${argv.id} to ${ticketDir}`);
    if (files.length > 0) deps.log(`Downloaded ${files.length} ticket files`);
  };

export const handler = createHandler();
