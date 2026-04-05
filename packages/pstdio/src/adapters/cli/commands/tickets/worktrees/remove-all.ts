import { removeWorktreeAndBranch as defaultRemoveWorktreeAndBranch } from "pstdio-wt";
import type { Arguments, Argv } from "yargs";
import { findGitRoot as defaultFindGitRoot, readConfig as defaultReadConfig } from "@/features/config/config";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "@/features/tickets/resolve-ticket-by-shorthand";
import { listWorkspaces as defaultListWorkspaces } from "@/features/workspaces/api/list-workspaces";

export const command = "remove-all";
export const describe = "Remove all worktrees for a ticket";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("project-id", { type: "string", describe: "Project ID" });

type RemoveAllArgs = {
  id: string;
  "project-id"?: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof defaultFindGitRoot;
  readConfig: typeof defaultReadConfig;
  resolveProjectId: typeof defaultResolveProjectId;
  resolveTicketByShorthand: typeof defaultResolveTicketByShorthand;
  listWorkspaces: typeof defaultListWorkspaces;
  removeWorktreeAndBranch: typeof defaultRemoveWorktreeAndBranch;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot: defaultFindGitRoot,
  readConfig: defaultReadConfig,
  resolveProjectId: defaultResolveProjectId,
  resolveTicketByShorthand: defaultResolveTicketByShorthand,
  listWorkspaces: defaultListWorkspaces,
  removeWorktreeAndBranch: defaultRemoveWorktreeAndBranch,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<RemoveAllArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const { projectId } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);

    const ticket = await deps.resolveTicketByShorthand(projectId, argv.id);
    if (!ticket) throw new Error(`Ticket not found: ${argv.id}`);

    const workspaces = await deps.listWorkspaces(projectId);
    const withWorktree = workspaces.filter((ws) => ws.ticket_shorthand === ticket.shorthand && ws.worktree_path);

    if (withWorktree.length === 0) {
      deps.log(`No worktrees found for ticket ${argv.id}`);
      return;
    }

    let removed = 0;
    for (const ws of withWorktree) {
      const branch = ws.branch ?? `workspace/${ws.workspace_shorthand}`;
      try {
        await deps.removeWorktreeAndBranch({ repoRoot: root, path: ws.worktree_path!, branch, force: true });
        removed++;
      } catch {
        deps.log(`Failed to remove worktree for ${ws.workspace_shorthand}`);
      }
    }

    deps.log(`Removed ${removed} worktree(s) for ticket ${argv.id}`);
  };

export const handler = createHandler();
