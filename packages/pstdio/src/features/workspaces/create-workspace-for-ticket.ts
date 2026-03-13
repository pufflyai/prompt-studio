import { exec as defaultExec } from "node:child_process";
import { API_URL } from "@/features/api-url";
import { createTicketAttempt as defaultCreateTicketAttempt } from "@/features/tickets/api/create-ticket-attempt";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";
import { runStartupScript } from "../../adapters/cli/commands/workspace/run-startup-script";
import { setStartupLog as defaultSetStartupLog } from "./api/set-startup-log";

type CreateWorkspaceForTicketInput = {
  projectId: string;
  repoRoot: string;
  ticketShorthand: string;
  base?: string;
};

type Deps = {
  listTickets: typeof defaultListTickets;
  createTicketAttempt: typeof defaultCreateTicketAttempt;
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
  createTicketAttempt: defaultCreateTicketAttempt,
  getStartupScript: defaultGetStartupScript,
  setStartupLog: defaultSetStartupLog,
  exec: defaultExec,
  log: console.log,
};

export const createWorkspaceForTicket = async (input: CreateWorkspaceForTicketInput, deps: Deps = defaultDeps) => {
  const { projectId, repoRoot, ticketShorthand, base } = input;
  const baseRef = base ?? "HEAD";

  const tickets = await deps.listTickets(API_URL, { project_id: projectId, shorthand: ticketShorthand });
  if (tickets.length === 0) throw new Error(`Ticket not found: ${ticketShorthand}`);
  const ticket = tickets[0];

  const { workspace } = await deps.createTicketAttempt(API_URL, ticket.id, {
    mode: "worktree",
    start_session: false,
    base: baseRef,
    repo_path: repoRoot,
  });

  const shorthand = workspace.workspace_shorthand;
  const wtPath = workspace.worktree_path ?? repoRoot;
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
