import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TerminalSessionRequest } from "pstdio-api-contracts/extension-kernel";
import { executeProjectExtensionCommand } from "../execute-project-extension-command";
import { createWorkspaceContextFixture } from "../workspace-context.test-fixture";
import { createCommandEnvironment } from "./index";

let fixture: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
let selectedRoot: string;
let requests: TerminalSessionRequest[];
beforeEach(async () => {
  fixture = await createWorkspaceContextFixture();
  selectedRoot = join(fixture.root, "second");
  await mkdir(selectedRoot);
  await writeFile(join(selectedRoot, "notes.txt"), "second repository");
  fixture.repos.push({ id: "repo-2", path: selectedRoot });
  requests = [];
  fixture.deps.terminal = {
    openSession(request) {
      requests.push(request);
      return {
        id: "terminal",
        write() {},
        resize() {},
        async kill() {},
        events: async function* () {
          yield { kind: "exit", code: 0, signal: null };
        },
      };
    },
  };
});
afterEach(async () => {
  await fixture.cleanup();
});

const environment = () =>
  createCommandEnvironment(fixture.deps, [fixture.source] as never, {
    project: { id: "project-1", name: "Project", shorthand: "P" },
    projectId: "project-1",
    extensionId: "example.context",
    name: "context",
    workspaceId: fixture.workspace.id,
    workspaceDir: selectedRoot,
    repo: { projectId: "project-1", repoId: "repo-2", path: selectedRoot },
  });
const command = [process.execPath, "-e", "console.log(process.cwd())"];
const events = async (env: ReturnType<typeof environment>) => {
  const received = [];
  for await (const event of env.terminal!.openSession({ cols: 80, rows: 24 }).events()) received.push(event);
  return received;
};

test("a real command uses its selected repository for working files and processes while project files stay home", async () => {
  await writeFile(
    join(fixture.root, "extension.ts"),
    `export default {
    commands: [{ id: "inspect", ref: { kind: "command", id: "inspect" }, title: "Inspect",
      async run(ctx) {
        const working = await ctx.workspaceFiles.readText("notes.txt");
        const repository = await ctx.repoFiles.readText("notes.txt");
        await ctx.workspaceFiles.writeText("created.txt", working);
        await ctx.workspaceFiles.syncDir("generated", [{ path: "tool.txt", content: working }]);
        const cwd = (await ctx.process.run({ command: ${JSON.stringify(command)} })).stdout.trim();
        for await (const event of ctx.terminal.openSession({ cols: 80, rows: 24 }).events()) {
          if (event.kind === "error") throw new Error(event.message);
        }
        return { working, repository, cwd, project: await ctx.projectFiles.readText("notes.txt"),
          defaultRoot: (await ctx.workspaces.getDefault()).root_path };
      }
    }]
  };`,
  );
  const result = await executeProjectExtensionCommand(fixture.deps, {
    projectId: "project-1",
    commandId: "example.context.command.inspect",
    body: { workspaceId: fixture.workspace.id, repo: { projectId: "project-1", repoId: "repo-2", path: "/untrusted" } },
  });
  expect(result.outcome).toMatchObject({
    status: "success",
    value: {
      working: "second repository",
      repository: "second repository",
      cwd: selectedRoot,
      project: "selected folder",
      defaultRoot: fixture.root,
    },
  });
  expect(await readFile(join(selectedRoot, "created.txt"), "utf8")).toBe("second repository");
  expect(await readFile(join(selectedRoot, "generated/tool.txt"), "utf8")).toBe("second repository");
  expect(requests[0]?.cwd).toBe(selectedRoot);
});

test("working targets revalidate repository membership on every access", async () => {
  const env = environment();
  fixture.repos.pop();
  await expect(env.workspaceFiles!.readText("notes.txt")).rejects.toThrow("no longer linked");
  await expect(env.workspaceFiles!.writeText("created.txt", "wrong")).rejects.toThrow("no longer linked");
  await expect(env.workspaceFiles!.syncDir("generated", [])).rejects.toThrow("no longer linked");
  await expect(env.process.run({ command })).rejects.toThrow("no longer linked");
  await expect(env.process.spawnDetached({ command })).rejects.toThrow("no longer linked");
  expect(await events(env)).toEqual([
    { kind: "error", message: expect.stringContaining("no longer linked") },
    { kind: "exit", code: null, signal: null },
  ]);
  expect(requests).toEqual([]);
  expect(await env.projectFiles!.readText("notes.txt")).toBe("selected folder");
});

test("a command rejects a repository from a different project", async () => {
  await expect(
    executeProjectExtensionCommand(fixture.deps, {
      projectId: "project-1",
      commandId: "example.context.command.inspect",
      body: { workspaceId: fixture.workspace.id, repo: { projectId: "other", repoId: "repo-2", path: selectedRoot } },
    }),
  ).rejects.toThrow("was not found in this project");
});

test("an explicit repository cannot redirect a recorded local workspace", async () => {
  Object.assign(fixture.workspace, { worktree_path: fixture.root });
  const env = environment();
  expect(await env.workspaceFiles!.readText("notes.txt")).toBe("selected folder");
  expect((await env.process.run({ command })).stdout.trim()).toBe(fixture.root);
  await events(env);
  expect(requests[0]?.cwd).toBe(fixture.root);
});

test("an explicit repository never supplies a remote workspace's local target", async () => {
  Object.assign(fixture.workspace, { execution_kind: "remote" });
  const env = environment();
  await expect(env.workspaceFiles!.readText("notes.txt")).rejects.toThrow("local file target");
  await expect(env.process.run({ command })).rejects.toThrow("local process target");
  expect((await events(env))[0]).toMatchObject({ kind: "error" });
  expect(requests).toEqual([]);
});
