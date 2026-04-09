import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { getTemplate } from "@/features/templates/api/get-template";
import { replacePlaceholders } from "@/features/templates/replace-placeholders";
import { extractRawTitle } from "@/features/tickets/display-title";
import { readTicketFile, resolveTicketDir } from "@/features/tickets/local-ticket";

export const command = "write";
export const describe = "Write a template to a ticket";

export const builder = (yargs: Argv) =>
  yargs
    .option("name", {
      type: "string",
      demandOption: true,
      describe: "Name of the template to use",
    })
    .option("target", {
      type: "string",
      demandOption: true,
      describe: "Target ticket shorthand",
    });

type WriteArgs = { name: string; target: string };

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  getTemplate: typeof getTemplate;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  getTemplate,
};

const writeTicketTemplate = (
  root: string,
  shorthand: string,
  templateName: string,
  templateContent: string,
  placeholders: Record<string, string>,
) => {
  const ticketDir = resolveTicketDir(root, shorthand);
  if (!ticketDir) throw new Error(`Ticket not found: ${shorthand}`);

  const existingContent = readTicketFile(root, shorthand);
  const existingTitle = existingContent ? extractRawTitle(existingContent) : null;

  placeholders.TICKET_ID = shorthand;
  placeholders.TICKET_TITLE = existingTitle ?? shorthand;

  writeFileSync(join(ticketDir, "ticket.md"), replacePlaceholders(templateContent, placeholders));
  console.log(`Wrote template "${templateName}" to .pstdio/tickets/${shorthand}/ticket.md`);
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<WriteArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const template = await deps.getTemplate(config.project_id, argv.name);
    if (!template) throw new Error(`Template not found: ${argv.name}`);

    const placeholders: Record<string, string> = {
      CREATED_AT: new Date().toISOString(),
      USER_PROMPT: "",
      PARENT_ID: "",
    };

    writeTicketTemplate(root, argv.target, argv.name, template.content, placeholders);
  };

export const handler = createHandler();
