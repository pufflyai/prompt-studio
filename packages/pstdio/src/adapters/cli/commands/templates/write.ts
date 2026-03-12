import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { getTemplate } from "@/features/templates/api/get-template";
import { replacePlaceholders } from "@/features/templates/replace-placeholders";

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

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<WriteArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const template = await deps.getTemplate(API_URL, config.project_id, argv.name);
    if (!template) {
      throw new Error(`Template not found: ${argv.name}`);
    }

    const docsTarget = isDocsTarget(argv.target);

    if (!docsTarget && template.template_type === "ticket") {
      // ticket target — ok for ticket templates
    }

    if (docsTarget && template.template_type === "ticket") {
      throw new Error("Ticket templates cannot target docs. Use a docs template instead.");
    }

    const now = new Date().toISOString();
    const placeholders: Record<string, string> = {
      CREATED_AT: now,
      USER_PROMPT: "",
      PARENT_ID: "",
    };

    if (docsTarget) {
      placeholders.TICKET_ID = "";
      placeholders.TICKET_TITLE = argv.name;

      const docPath = argv.target.replace(/^docs\//, "");
      const filePath = join(root, ".pstdio", "docs", `${docPath}.md`);

      mkdirSync(dirname(filePath), { recursive: true });

      const content = replacePlaceholders(template.content, placeholders);
      writeFileSync(filePath, content);

      console.log(`Wrote template "${argv.name}" to .pstdio/docs/${docPath}.md`);
    } else {
      const shorthand = argv.target;
      const ticketDir = join(root, ".pstdio", "tickets", shorthand);

      if (!existsSync(ticketDir)) {
        throw new Error(`Ticket not found: ${shorthand}`);
      }

      placeholders.TICKET_ID = shorthand;
      placeholders.TICKET_TITLE = shorthand;

      const filePath = join(ticketDir, "ticket.md");
      const content = replacePlaceholders(template.content, placeholders);
      writeFileSync(filePath, content);

      console.log(`Wrote template "${argv.name}" to .pstdio/tickets/${shorthand}/ticket.md`);
    }
  };

export const handler = createHandler();
