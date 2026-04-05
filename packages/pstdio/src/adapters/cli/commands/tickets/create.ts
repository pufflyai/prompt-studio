import type { Arguments, Argv } from "yargs";
import { readConfig } from "@/features/config/config";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { createTicket as defaultCreateTicket } from "@/features/tickets/api/create-ticket";
import { updateTicket as defaultUpdateTicket } from "@/features/tickets/api/update-ticket";
import { uploadTicketFile as defaultUploadTicketFile } from "@/features/tickets/api/upload-ticket-file";
import { writeTicketFile as defaultWriteTicketFile } from "@/features/tickets/local-ticket";
import { resolveStatusId as defaultResolveStatusId } from "@/features/tickets/resolve-status-id";
import { resolveTagIds as defaultResolveTagIds } from "@/features/tickets/resolve-tag-ids";
import { applyFrontmatterValues, buildTicketFrontmatter } from "@/features/tickets/ticket-frontmatter";

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
  resolveProjectId: typeof defaultResolveProjectId;
  readConfig: typeof readConfig;
  createTicket: typeof defaultCreateTicket;
  updateTicket: typeof defaultUpdateTicket;
  uploadTicketFile: typeof defaultUploadTicketFile;
  resolveStatusId: typeof defaultResolveStatusId;
  resolveTagIds: typeof defaultResolveTagIds;
  writeTicketFile: typeof defaultWriteTicketFile;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  readConfig,
  createTicket: defaultCreateTicket,
  updateTicket: defaultUpdateTicket,
  uploadTicketFile: defaultUploadTicketFile,
  resolveStatusId: defaultResolveStatusId,
  resolveTagIds: defaultResolveTagIds,
  writeTicketFile: defaultWriteTicketFile,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<CreateArgs>) => {
    const { root, projectId } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);
    const tagIds = argv.tag?.length ? await deps.resolveTagIds(projectId, argv.tag) : undefined;
    const statusId = argv.status ? await deps.resolveStatusId(projectId, argv.status) : undefined;

    const ticket = await deps.createTicket({
      project_id: projectId,
      content: argv.content,
      draft: false,
      tag_ids: tagIds,
      status_id: statusId,
    });

    const ticketContent = `# ${argv.content}\n`;
    const contentBase64 = Buffer.from(ticketContent).toString("base64");
    const uploaded = await deps.uploadTicketFile(ticket.id, {
      file_name: "ticket.md",
      content_base64: contentBase64,
      mime_type: "text/markdown",
    });
    await deps.updateTicket(ticket.id, { file_id: uploaded.id });

    const isLocalProject = root && deps.readConfig(root);
    if (isLocalProject) {
      const frontmatter = buildTicketFrontmatter({
        shorthand: ticket.shorthand,
        created_at: ticket.created_at,
        draft: false,
        status_name: argv.status ?? null,
        parent_id: null,
        user_prompt: null,
        depends_on: null,
        parallelizable: null,
        blocked_reason: null,
        tag_names: [],
      });
      const content = applyFrontmatterValues(frontmatter, ticketContent);
      deps.writeTicketFile(root, ticket.shorthand, content);
    }

    deps.log(`Created ticket ${ticket.shorthand}`);
  };

export const handler = createHandler();
