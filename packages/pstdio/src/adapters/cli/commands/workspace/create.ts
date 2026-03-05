import { exec as defaultExec } from "node:child_process";
import { join } from "node:path";
import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";
import { createWorkspace as defaultCreateWorkspace } from "@/features/workspaces/api/create-workspace";
import { createWorktree as defaultCreateWorktree } from "@/features/workspaces/git-ops";

export const command = "create";
export const describe = "Create a workspace for a ticket";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("base", { type: "string", describe: "Base branch/ref. Defaults to HEAD" })
    .option("target", { type: "string", default: "worktree", describe: "Workspace target (only 'worktree')" });

type CreateArgs = {
  id: string;
  base?: string;
  target: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listTickets: typeof defaultListTickets;
  createWorkspace: typeof defaultCreateWorkspace;
  createWorktree: (repoRoot: string, path: string, branch: string, baseRef: string) => Promise<void>;
  getStartupScript: (baseUrl: string, projectId: string) => Promise<string | null>;
  exec: typeof defaultExec;
  log: (msg: string) => void;
};

const defaultGetStartupScript = async (baseUrl: string, projectId: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${encodeURIComponent(projectId)}`);
  if (!res.ok) return null;
  const project = (await res.json()) as { startup_script?: string | null };
  return project.startup_script ?? null;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listTickets: defaultListTickets,
  createWorkspace: defaultCreateWorkspace,
  createWorktree: defaultCreateWorktree,
  getStartupScript: defaultGetStartupScript,
  exec: defaultExec,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<CreateArgs>) => {
    if (argv.target !== "worktree") {
      throw new Error(`Invalid target: ${argv.target}. Must be 'worktree'.`);
    }

    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const projectId = config.project_id;

    // Resolve ticket
    const tickets = await deps.listTickets(API_URL, { project_id: projectId, shorthand: argv.id });
    if (tickets.length === 0) throw new Error(`Ticket not found: ${argv.id}`);
    const ticket = tickets[0];

    const baseRef = argv.base ?? "HEAD";

    // Create workspace via API (allocates shorthand)
    const workspace = await deps.createWorkspace(API_URL, {
      project_id: projectId,
      ticket_id: ticket.id,
      ticket_shorthand: ticket.shorthand,
      branch: `workspace/${ticket.shorthand}`,
      worktree_path: join(root, ".pstdio", "workspaces", ticket.shorthand),
    });

    const shorthand = workspace.workspace_shorthand;
    const branch = `workspace/${shorthand}`;
    const wtPath = join(root, ".pstdio", "workspaces", shorthand);

    // Create git worktree
    await deps.createWorktree(root, wtPath, branch, baseRef);

    deps.log(`Created workspace ${shorthand} for ${argv.id} at .pstdio/workspaces/${shorthand}`);

    // Run startup script if configured
    const script = await deps.getStartupScript(API_URL, projectId);
    if (script) {
      deps.log("Running startup script...");
      try {
        await new Promise<void>((resolve, reject) => {
          const child = deps.exec(script, { cwd: wtPath }, (error) => {
            if (error) reject(error);
            else resolve();
          });
          child.stdout?.pipe(process.stdout);
          child.stderr?.pipe(process.stderr);
        });
        deps.log("Startup script completed.");
      } catch (err) {
        const code = (err as { code?: number }).code ?? 1;
        deps.log(`Warning: startup script exited with code ${code}.`);
      }
    }
  };

export const handler = createHandler();
