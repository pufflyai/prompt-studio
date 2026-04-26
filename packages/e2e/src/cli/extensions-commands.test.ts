import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, createProjectViaApi, runPstdio } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
const dirs: string[] = [];

beforeAll(async () => {
  api = await startApi();
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

afterEach(() => {
  cleanupDirs(dirs);
});

const run = (args: string, cwd: string) => runPstdio(args, cwd, { PSTDIO_API_URL: api.url });

describe("pstdio extension commands", () => {
  test(
    "executes a plugin command via the real CLI path and persists extension storage",
    async () => {
      const project = await createProjectViaApi(api.url, "extension-command-project");
      const repo = createGitRepo();
      dirs.push(repo);

      run(`projects link --project-id ${project.id}`, repo);

      const pluginsDir = join(repo, ".pstdio", "plugins");
      mkdirSync(pluginsDir, { recursive: true });
      writeFileSync(
        join(pluginsDir, "extension-lab.ts"),
        `export default {
          commands: [{
            key: "remember",
            path: "lab remember",
            description: "Remember command invocation",
            targetType: "project",
            params: [
              { key: "note", label: "Note", type: "text", required: true },
              { key: "times", label: "Times", type: "number", required: true },
              { key: "enabled", label: "Enabled", type: "boolean" },
              {
                key: "mode",
                label: "Mode",
                type: "select",
                options: [
                  { value: "safe", label: "Safe" },
                  { value: "fast", label: "Fast" },
                ],
              },
            ],
            async run(ctx) {
              await ctx.storage.set("last-run", {
                projectId: ctx.projectId,
                targetId: ctx.target.id,
                params: ctx.params,
              });

              return { message: "remembered " + ctx.params.note };
            },
          }],
        };`,
      );

      const output = run("lab remember --note hello --times 2 --enabled --mode safe", repo);
      expect(output).toContain("remembered hello");

      const projectsOutput = run("projects list", repo);
      expect(projectsOutput).toContain("extension-command-project");

      const statePath = join(repo, ".pstdio", "extensions", ".storage", "extension-lab.json");
      const state = JSON.parse(readFileSync(statePath, "utf8")) as {
        "last-run": {
          projectId: string;
          targetId: string;
          params: {
            note: string;
            times: number;
            enabled: boolean;
            mode: string;
          };
        };
      };

      expect(state["last-run"].projectId).toBe(project.id);
      expect(state["last-run"].params).toEqual({
        note: "hello",
        times: 2,
        enabled: true,
        mode: "safe",
      });
    },
    TEST_TIMEOUT,
  );

  test(
    "executes chained commands from nested extension identities",
    async () => {
      const project = await createProjectViaApi(api.url, "nested-extension-command-project");
      const repo = createGitRepo();
      dirs.push(repo);

      run(`projects link --project-id ${project.id}`, repo);

      const pluginsDir = join(repo, ".pstdio", "plugins", "nested");
      mkdirSync(pluginsDir, { recursive: true });
      writeFileSync(
        join(pluginsDir, "extension.ts"),
        `export default {
          commands: [
            {
              key: "first",
              path: "lab nested-first",
              description: "First",
              targetType: "project",
              async run(ctx) {
                return ctx.commands.run("second");
              },
            },
            {
              key: "second",
              path: "lab nested-second",
              description: "Second",
              targetType: "project",
              async run(ctx) {
                await ctx.storage.set("last-run", { projectId: ctx.projectId });
                return { message: "nested chained" };
              },
            },
          ],
        };`,
      );

      const output = run("lab nested-first", repo);
      expect(output).toContain("nested chained");

      const statePath = join(repo, ".pstdio", "extensions", ".storage", "nested", "extension.json");
      const state = JSON.parse(readFileSync(statePath, "utf8")) as {
        "last-run": {
          projectId: string;
        };
      };

      expect(state["last-run"].projectId).toBe(project.id);
    },
    TEST_TIMEOUT,
  );

  test(
    "does not allow extension commands to shadow built-in command roots",
    async () => {
      const project = await createProjectViaApi(api.url, "collision-extension-command-project");
      const repo = createGitRepo();
      dirs.push(repo);

      run(`projects link --project-id ${project.id}`, repo);

      const pluginsDir = join(repo, ".pstdio", "plugins");
      mkdirSync(pluginsDir, { recursive: true });
      writeFileSync(
        join(pluginsDir, "collision.ts"),
        `export default {
          commands: [{
            key: "shadow-list",
            path: "projects list",
            description: "Attempt to shadow built-in command",
            targetType: "project",
            run() {
              return { message: "shadowed" };
            },
          }],
        };`,
      );

      const output = run("projects list", repo);
      expect(output).toContain("collision-extension-command-project");
      expect(output).not.toContain("shadowed");
    },
    TEST_TIMEOUT,
  );

  test(
    "resolves workspace targets from the real CLI surface",
    async () => {
      const project = await createProjectViaApi(api.url, "workspace-extension-command-project");
      const repo = createGitRepo();
      dirs.push(repo);

      run(`projects link --project-id ${project.id}`, repo);

      const ticketRes = await fetch(`${api.url}/v1/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: project.id, user_prompt: "workspace target" }),
      });
      const ticket = (await ticketRes.json()) as { id: string; shorthand: string };

      const workspaceRes = await fetch(`${api.url}/v1/workspaces`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          ticket_id: ticket.id,
          ticket_shorthand: ticket.shorthand,
          worktree_path: join(repo, "workspace-1"),
        }),
      });
      const workspace = (await workspaceRes.json()) as { workspace_shorthand: string };

      const pluginsDir = join(repo, ".pstdio", "plugins");
      mkdirSync(pluginsDir, { recursive: true });
      writeFileSync(
        join(pluginsDir, "workspace-command.ts"),
        `export default {
          commands: [{
            key: "workspace-note",
            path: "lab workspace-note",
            description: "Workspace command",
            targetType: "workspace",
            async run(ctx) {
              await ctx.storage.set("workspace", {
                id: ctx.target.id,
                shorthand: ctx.target.workspace_shorthand,
              });
              return { message: "workspace " + ctx.target.workspace_shorthand };
            },
          }],
        };`,
      );

      const output = run(`lab workspace-note --workspace ${workspace.workspace_shorthand}`, repo);
      expect(output).toContain(`workspace ${workspace.workspace_shorthand}`);

      const statePath = join(repo, ".pstdio", "extensions", ".storage", "workspace-command.json");
      const state = JSON.parse(readFileSync(statePath, "utf8")) as {
        workspace: {
          shorthand: string;
        };
      };

      expect(state.workspace.shorthand).toBe(workspace.workspace_shorthand);
    },
    TEST_TIMEOUT,
  );
});
