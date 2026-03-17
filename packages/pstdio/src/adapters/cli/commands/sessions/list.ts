import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listSessions as defaultListSessions } from "@/features/sessions/api/list-sessions";

export const command = "list";
export const describe = "List sessions for the current project";

export const builder = (yargs: Argv) =>
  yargs
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("status", { type: "string", describe: "Filter by status" })
    .option("agent", { type: "string", describe: "Filter by agent" })
    .option("workspace-id", { type: "string", describe: "Filter by workspace ID" })
    .option("archived", { type: "boolean", describe: "Include archived sessions" });

export type ListArgs = {
  "project-id"?: string;
  status?: string;
  agent?: string;
  "workspace-id"?: string;
  archived?: boolean;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listSessions: typeof defaultListSessions;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listSessions: defaultListSessions,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ListArgs>) => {
    let projectId = argv["project-id"];

    if (!projectId) {
      const root = deps.findGitRoot(deps.cwd());
      if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");
      const config = deps.readConfig(root);
      if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");
      projectId = config.project_id;
    }

    const sessions = await deps.listSessions(API_URL, projectId, {
      status: argv.status,
      agent: argv.agent,
      workspaceId: argv["workspace-id"],
      archived: argv.archived,
    });

    if (sessions.length === 0) {
      deps.log("No sessions found.");
      return;
    }

    const header = "ID           Status           Agent          Started";
    const rows = sessions.map(
      (s) =>
        `${s.id.slice(0, 12).padEnd(13)}${(s.status ?? "").padEnd(17)}${(s.agent ?? "-").padEnd(15)}${s.created_at}`,
    );

    deps.log([header, ...rows].join("\n"));
  };

export const handler = createHandler();
