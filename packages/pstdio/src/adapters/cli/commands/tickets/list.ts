import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";

export const command = "list";
export const describe = "List tickets";

export const builder = (yargs: Argv) =>
  yargs
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("status", { type: "string", describe: "Filter by status name" })
    .option("tag", { type: "array", string: true, describe: "Filter by tag" })
    .option("priority", { type: "string", describe: "Filter by priority" })
    .option("complexity", { type: "string", describe: "Filter by complexity" })
    .option("archived", { type: "boolean", describe: "Include archived" })
    .option("draft", { type: "boolean", describe: "Include drafts" })
    .option("parent-id", { type: "string", describe: "Filter by parent ticket" });

type ListArgs = {
  "project-id"?: string;
  status?: string;
  tag?: string[];
  priority?: string;
  complexity?: string;
  archived?: boolean;
  draft?: boolean;
  "parent-id"?: string;
};

type TicketListItem = {
  shorthand: string;
  title: string | null;
  status_name: string | null;
  tag_names: string[];
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listTickets: typeof defaultListTickets;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listTickets: defaultListTickets,
  log: console.log,
};

const formatTable = (tickets: TicketListItem[]) => {
  const header = { shorthand: "Shorthand", title: "Title", status: "Status", tags: "Tags" };
  const rows = tickets.map((t) => ({
    shorthand: t.shorthand,
    title: t.title ?? "",
    status: t.status_name ?? "",
    tags: t.tag_names.join(", "),
  }));

  const widths = {
    shorthand: Math.max(header.shorthand.length, ...rows.map((r) => r.shorthand.length)),
    title: Math.max(header.title.length, ...rows.map((r) => r.title.length)),
    status: Math.max(header.status.length, ...rows.map((r) => r.status.length)),
    tags: Math.max(header.tags.length, ...rows.map((r) => r.tags.length)),
  };

  const pad = (s: string, w: number) => s.padEnd(w);
  const line = (r: { shorthand: string; title: string; status: string; tags: string }) =>
    `${pad(r.shorthand, widths.shorthand)}   ${pad(r.title, widths.title)}   ${pad(r.status, widths.status)}   ${pad(r.tags, widths.tags)}`;

  return [line(header), ...rows.map(line)].join("\n");
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ListArgs>) => {
    let projectId = argv["project-id"];

    if (!projectId) {
      const root = deps.findGitRoot(deps.cwd());
      if (!root) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      const config = deps.readConfig(root);
      if (!config) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      projectId = config.project_id;
    }

    const tickets = await deps.listTickets(API_URL, {
      project_id: projectId,
      status: argv.status,
      tag: argv.tag,
      priority: argv.priority,
      complexity: argv.complexity,
      archived: argv.archived,
      draft: argv.draft,
      parent_id: argv["parent-id"],
    });

    if (tickets.length === 0) {
      deps.log("No tickets found.");
      return;
    }

    deps.log(formatTable(tickets));
  };

export const handler = createHandler();
