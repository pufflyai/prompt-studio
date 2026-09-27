import { afterAll, expect, test } from "bun:test";
import { PSTDIO_E2E_PLANNER_EXTENSION } from "../default-extensions";
import { cleanupDirs, createInitializedRepo, runPstdio } from "./helpers";
import { startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

const dirs: string[] = [];
afterAll(() => cleanupDirs(dirs));

test(
  "links two tickets to a standalone workspace and removes only the selected link",
  async () => {
    const api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: PSTDIO_E2E_PLANNER_EXTENSION } });
    try {
      const run = (args: string, cwd: string) => runPstdio(args, cwd, { PSTDIO_API_URL: api.url });
      const repo = createInitializedRepo({ name: "shared-workspace", dirs, run, withInitialCommit: true });
      const one = JSON.parse(run('tickets create --title "One"', repo));
      const two = JSON.parse(run('tickets create --title "Two"', repo));
      const created = run("workspaces create --provider pstdio.worktree", repo);
      const [, workspace, rootPath] = created.match(/Created workspace (WS-\d+) at (.+)/) ?? [];
      expect(workspace).toBeTruthy();
      expect(rootPath).toBeTruthy();
      for (const ticket of [one, two, one]) {
        const result = JSON.parse(run(`tickets link --id ${ticket.shorthand} --workspace ${workspace}`, repo));
        expect(result).toMatchObject({
          ticket: ticket.shorthand,
          workspace: { workspace_shorthand: workspace, root_path: rootPath },
        });
      }
      expect(() => run(`tickets worktrees remove-all --id ${one.shorthand}`, repo)).toThrow(
        `${workspace} is linked to other tickets`,
      );
      for (const ticket of [one, two]) {
        expect(JSON.parse(run(`tickets workspaces --id ${ticket.shorthand}`, repo))).toEqual([
          expect.objectContaining({ workspace }),
        ]);
      }
      run(`tickets unlink --id ${one.shorthand} --workspace ${workspace}`, repo);
      expect(JSON.parse(run(`tickets workspaces --id ${one.shorthand}`, repo))).toEqual([]);
      expect(JSON.parse(run(`tickets workspaces --id ${two.shorthand}`, repo))).toHaveLength(1);
      run(`workspaces delete --id ${workspace}`, repo);
    } finally {
      await api.stop();
    }
  },
  SETUP_TIMEOUT + TEST_TIMEOUT,
);
