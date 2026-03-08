import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { getTemplate } from "@/features/templates/api/get-template";
import { replacePlaceholders } from "@/features/templates/replace-placeholders";
import { createTicket as defaultCreateTicket } from "@/features/tickets/api/create-ticket";
import { writeTicketFile } from "@/features/tickets/local-ticket";
import { resolveStatusId as defaultResolveStatusId } from "@/features/tickets/resolve-status-id";
import { resolveTagIds as defaultResolveTagIds } from "@/features/tickets/resolve-tag-ids";
import { applyFrontmatter, buildTicketFrontmatter } from "@/features/tickets/ticket-frontmatter";

export const command = "write";
export const describe = "Create a draft ticket with a local file";

export const builder = (yargs: Argv) =>
  yargs
    .option("title", { type: "string", demandOption: true, describe: "Ticket title" })
    .option("template", { type: "string", describe: "Template name" })
    .option("tag", { type: "array", string: true, describe: "Tags to assign" })
    .option("status", { type: "string", describe: "Status name to assign" })
    .option("user-prompt", { type: "string", describe: "User prompt for the ticket" })
    .option("parent-id", { type: "string", describe: "Parent ticket shorthand" });

type WriteArgs = {
  title: string;
  template?: string;
  tag?: string[];
  status?: string;
  "user-prompt"?: string;
  "parent-id"?: string;
};

type Deps = {
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  getTemplate: typeof getTemplate;
  createTicket: typeof defaultCreateTicket;
  resolveStatusId: typeof defaultResolveStatusId;
  resolveTagIds: typeof defaultResolveTagIds;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  getTemplate,
  createTicket: defaultCreateTicket,
  resolveStatusId: defaultResolveStatusId,
  resolveTagIds: defaultResolveTagIds,
  log: console.log,
};

const renderTemplate = (templateContent: string, shorthand: string, argv: Arguments<WriteArgs>, createdAt: string) =>
  replacePlaceholders(templateContent, {
    TICKET_ID: shorthand,
    TICKET_TITLE: argv.title,
    CREATED_AT: createdAt,
    INPUT: argv["user-prompt"] ?? "",
    PARENT_ID: argv["parent-id"] ?? "",
    USER_PROMPT: argv["user-prompt"] ?? "",
    STATUS: argv.status ?? "backlog",
  });

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<WriteArgs>) => {
    const { root, projectId } = deps.resolveProjectId(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");
    const tagIds = argv.tag?.length ? await deps.resolveTagIds(API_URL, projectId, argv.tag) : undefined;
    const statusId = argv.status ? await deps.resolveStatusId(API_URL, projectId, argv.status) : undefined;

    const ticket = await deps.createTicket(API_URL, {
      project_id: projectId,
      content: `# ${argv.title}\n`,
      user_prompt: argv["user-prompt"],
      parent_id: argv["parent-id"],
      draft: true,
      tag_ids: tagIds,
      status_id: statusId,
    });

    let content: string;
    if (argv.template) {
      const template = await deps.getTemplate(API_URL, projectId, argv.template);
      if (!template) throw new Error(`Template not found: ${argv.template}`);
      content = renderTemplate(template.content, ticket.shorthand, argv, ticket.created_at);
    } else {
      const body = `# ${argv.title}\n`;
      const frontmatter = buildTicketFrontmatter({
        shorthand: ticket.shorthand,
        created_at: ticket.created_at,
        status_name: argv.status ?? null,
        parent_id: argv["parent-id"] ?? null,
        user_prompt: argv["user-prompt"] ?? null,
        priority: null,
        complexity: null,
        depends_on: null,
        parallelizable: null,
        blocked_reason: null,
      });
      content = applyFrontmatter(frontmatter, body);
    }

    const filePath = writeTicketFile(root, ticket.shorthand, content);
    const relativePath = filePath.replace(`${root}/`, "");

    deps.log(`Created ticket ${ticket.shorthand} (draft) at ${relativePath}`);
  };

export const handler = createHandler();
