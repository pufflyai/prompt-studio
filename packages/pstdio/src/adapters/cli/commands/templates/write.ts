import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { getTemplate } from "@/features/templates/api/get-template";
import { replacePlaceholders } from "@/features/templates/replace-placeholders";
import { extractRawTitle } from "@/features/tickets/display-title";
import { readTicketFile, resolveTicketDir } from "@/features/tickets/local-ticket";
import { parseVars } from "../parse-vars";

export const command = "write";
export const describe = "Write a template to a file or ticket";

export const builder = (yargs: Argv) =>
  yargs
    .option("name", {
      type: "string",
      demandOption: true,
      describe: "Name of the template to use",
    })
    .option("target", {
      type: "string",
      describe: "Destination path, relative to the current directory (overwrites any existing file)",
    })
    .option("ticket", {
      type: "string",
      describe: "Ticket shorthand; writes to .pstdio/tickets/<shorthand>/ticket.md and preserves the existing title",
    })
    .option("var", {
      type: "string",
      array: true,
      describe: "Template variable in key=value format (repeatable)",
    });

type WriteArgs = { name: string; target?: string; ticket?: string; var?: string[] };

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

const writeToPath = (
  cwd: string,
  target: string,
  templateName: string,
  templateContent: string,
  placeholders: Record<string, string>,
) => {
  const absolutePath = isAbsolute(target) ? target : resolve(cwd, target);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, replacePlaceholders(templateContent, placeholders));

  const displayPath = isAbsolute(target) ? absolutePath : relative(cwd, absolutePath);
  console.log(`Wrote template "${templateName}" to ${displayPath}`);
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<WriteArgs>) => {
    if (argv.target && argv.ticket) throw new Error("--target and --ticket are mutually exclusive.");
    if (!argv.target && !argv.ticket) throw new Error("Exactly one of --target or --ticket is required.");

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
      ...(parseVars(argv.var) ?? {}),
    };

    if (argv.ticket) {
      writeTicketTemplate(root, argv.ticket, argv.name, template.content, placeholders);
      return;
    }

    writeToPath(deps.cwd(), argv.target!, argv.name, template.content, placeholders);
  };

export const handler = createHandler();
