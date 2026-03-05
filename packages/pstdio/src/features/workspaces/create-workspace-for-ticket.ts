import { exec as defaultExec } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { createWorktree as defaultCreateWorktree } from "pstdio-wt";
import { API_URL } from "@/features/api-url";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";
import { runStartupScript } from "../../adapters/cli/commands/workspace/run-startup-script";
import { createWorkspace as defaultCreateWorkspace } from "./api/create-workspace";
import { setStartupLog as defaultSetStartupLog } from "./api/set-startup-log";

type CreateWorkspaceForTicketInput = {
  projectId: string;
  repoRoot: string;
  ticketShorthand: string;
  base?: string;
};

type Deps = {
  listTickets: typeof defaultListTickets;
  createWorkspace: typeof defaultCreateWorkspace;
  createWorktree: (opts: { repoRoot: string; branch: string; path: string; base?: string }) => Promise<unknown>;
  getStartupScript: (baseUrl: string, projectId: string) => Promise<string | null>;
  setStartupLog: typeof defaultSetStartupLog;
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
  listTickets: defaultListTickets,
  createWorkspace: defaultCreateWorkspace,
  createWorktree: defaultCreateWorktree,
  getStartupScript: defaultGetStartupScript,
  setStartupLog: defaultSetStartupLog,
  exec: defaultExec,
  log: console.log,
};

export const createWorkspaceForTicket = async (input: CreateWorkspaceForTicketInput, deps: Deps = defaultDeps) => {
  const { projectId, repoRoot, ticketShorthand, base } = input;
  const baseRef = base ?? "HEAD";
  const globalDir = join(homedir(), ".pstdio", "workspaces");

  const tickets = await deps.listTickets(API_URL, { project_id: projectId, shorthand: ticketShorthand });
  if (tickets.length === 0) throw new Error(`Ticket not found: ${ticketShorthand}`);
  const ticket = tickets[0];

  const workspace = await deps.createWorkspace(API_URL, {
    project_id: projectId,
    ticket_id: ticket.id,
    ticket_shorthand: ticket.shorthand,
    branch: `workspace/${ticket.shorthand}`,
    worktree_path: join(globalDir, ticket.shorthand),
  });

  const shorthand = workspace.workspace_shorthand;
  const branch = `workspace/${shorthand}`;
  const wtPath = join(globalDir, shorthand);

  await deps.createWorktree({ repoRoot, branch, path: wtPath, base: baseRef });
  deps.log(`Created workspace ${shorthand} for ${ticketShorthand} at ${wtPath}`);

  const script = await deps.getStartupScript(API_URL, projectId);
  if (script) {
    await runStartupScript(
      { exec: deps.exec, log: deps.log, setStartupLog: deps.setStartupLog },
      { script, cwd: wtPath, apiUrl: API_URL, workspaceId: workspace.id, workspaceShorthand: shorthand },
    );
  }

  return workspace;
};
