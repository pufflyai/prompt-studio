import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { getTemplate } from "@/features/templates/api/get-template";
import { replacePlaceholders } from "@/features/templates/replace-placeholders";
import { extractRawTitle } from "@/features/tickets/display-title";
import { readTicketFile, resolveTicketDir } from "@/features/tickets/local-ticket";

export const command = "write";
export const describe = "Write a template to a docs path or ticket";

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
      describe: "Target path: docs/<path> or <ticket-shorthand>",
    });

type WriteArgs = { name: string; target: string };

const isDocsTarget = (target: string) => target.startsWith("docs/");

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

const writeDocsTemplate = (
  root: string,
  templateName: string,
  target: string,
  templateContent: string,
  placeholders: Record<string, string>,
) => {
  placeholders.TICKET_ID = "";
  placeholders.TICKET_TITLE = templateName;

  const docPath = target.replace(/^docs\//, "");
  const filePath = join(root, ".pstdio", "docs", `${docPath}.md`);

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, replacePlaceholders(templateContent, placeholders));
  console.log(`Wrote template "${templateName}" to .pstdio/docs/${docPath}.md`);
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

    const template = await deps.getTemplate(API_URL, config.project_id, argv.name);
    if (!template) throw new Error(`Template not found: ${argv.name}`);

    const docsTarget = isDocsTarget(argv.target);

    if (docsTarget && template.template_type === "ticket") {
      throw new Error("Ticket templates cannot target docs. Use a docs template instead.");
    }

    const placeholders: Record<string, string> = {
      CREATED_AT: new Date().toISOString(),
      USER_PROMPT: "",
      PARENT_ID: "",
    };

    if (docsTarget) {
      writeDocsTemplate(root, argv.name, argv.target, template.content, placeholders);
    } else {
      writeTicketTemplate(root, argv.target, argv.name, template.content, placeholders);
    }
  };

export const handler = createHandler();
