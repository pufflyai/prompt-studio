import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { updateTicket as defaultUpdateTicket } from "@/features/tickets/api/update-ticket";
import { uploadTicketFile as defaultUploadTicketFile } from "@/features/tickets/api/upload-ticket-file";
import { extractDisplayTitle } from "@/features/tickets/display-title";
import {
  listTicketFiles,
  readTicketAttachment,
  readTicketFile,
  writeTicketFile,
} from "@/features/tickets/local-ticket";
import { resolveStatusId as defaultResolveStatusId } from "@/features/tickets/resolve-status-id";
import { resolveTagIds as defaultResolveTagIds } from "@/features/tickets/resolve-tag-ids";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "@/features/tickets/resolve-ticket-by-shorthand";
import { applyFrontmatterValues, parseFrontmatter, stripFrontmatter } from "@/features/tickets/ticket-frontmatter";

export const command = "save";
export const describe = "Save local ticket content and files to the database";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("status", { type: "string", describe: "Status name to assign" })
    .option("tag", { type: "array", string: true, describe: "Tags to assign" });

type SaveArgs = {
  id: string;
  status?: string;
  tag?: string[];
};

type Deps = {
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  resolveTicketByShorthand: typeof defaultResolveTicketByShorthand;
  updateTicket: typeof defaultUpdateTicket;
  uploadTicketFile: typeof defaultUploadTicketFile;
  resolveStatusId: typeof defaultResolveStatusId;
  resolveTagIds: typeof defaultResolveTagIds;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  resolveTicketByShorthand: defaultResolveTicketByShorthand,
  updateTicket: defaultUpdateTicket,
  uploadTicketFile: defaultUploadTicketFile,
  resolveStatusId: defaultResolveStatusId,
  resolveTagIds: defaultResolveTagIds,
  log: console.log,
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

const markLocalTicketAsSaved = (content: string) =>
  applyFrontmatterValues(["---", "draft: false", "---"].join("\n"), content);

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<SaveArgs>) => {
    const { root, projectId } = deps.resolveProjectId(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const content = readTicketFile(root, argv.id);
    if (content === null) {
      throw new Error(`Local ticket not found: .pstdio/tickets/${argv.id}/ticket.md`);
    }

    const ticket = await deps.resolveTicketByShorthand(API_URL, projectId, argv.id);
    if (!ticket) throw new Error(`Ticket not found: ${argv.id}`);

    const frontmatter = parseFrontmatter(content);

    const statusName = argv.status ?? frontmatter.status;
    const tagIds = argv.tag?.length ? await deps.resolveTagIds(API_URL, projectId, argv.tag) : undefined;
    const statusId = statusName ? await deps.resolveStatusId(API_URL, projectId, statusName) : undefined;

    const bodyContent = stripFrontmatter(content).replace(/^\n+/, "");
    const contentBase64 = Buffer.from(bodyContent).toString("base64");
    const uploaded = await deps.uploadTicketFile(API_URL, ticket.id, {
      file_name: "ticket.md",
      content_base64: contentBase64,
      mime_type: "text/markdown",
    });

    await deps.updateTicket(API_URL, ticket.id, {
      blocked_reason: frontmatter.blocked_reason,
      file_id: uploaded.id,
      display_title: extractDisplayTitle(bodyContent),
      draft: false,
      parent_id: frontmatter.parent_id,
      tag_ids: tagIds,
      status_id: statusId,
    });

    const uploadedCount = await uploadLocalTicketFiles(deps, root, argv.id, ticket.id);
    writeTicketFile(root, argv.id, markLocalTicketAsSaved(content));

    deps.log(`Saved ticket ${argv.id}`);
    if (uploadedCount > 0) deps.log(`Uploaded ${uploadedCount} ticket files`);
  };

export const handler = createHandler();
