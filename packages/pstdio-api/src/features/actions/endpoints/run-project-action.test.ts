import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

const repoRoot = join(import.meta.dirname, "../../../../../..");
const dashboardPort = 45173;
const apiPort = 45174;
const previousPath = process.env.PATH;

let app: OpenAPIHono<AppBindings>;
let close: () => Promise<void>;
let tempRoot: string;
let projectId: string;
let workspaceId: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-run-project-action-"));
  const repoPath = join(tempRoot, "repo");
  const pstdioDir = join(repoPath, ".pstdio");
  const pluginsDir = join(pstdioDir, "plugins");
  const pluginSdkScopeDir = join(pstdioDir, "node_modules", "@pstdio");
  const composeDir = join(repoPath, "infra", "local");
  const binDir = join(tempRoot, "bin");

  mkdirSync(pluginsDir, { recursive: true });
  mkdirSync(pluginSdkScopeDir, { recursive: true });
  mkdirSync(composeDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });

  execSync("git init", { cwd: repoPath, stdio: "ignore" });
  execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: "ignore" });
  execSync('git config user.name "Test"', { cwd: repoPath, stdio: "ignore" });
  writeFileSync(join(repoPath, "README.md"), "run project action test\n");
  execSync("git add README.md", { cwd: repoPath, stdio: "ignore" });
  execSync('git commit -m "init"', { cwd: repoPath, stdio: "ignore" });
  writeFileSync(
    join(pstdioDir, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies: { "@pstdio/sdk": "workspace:*" },
      },
      null,
      2,
    )}\n`,
  );
  symlinkSync(join(repoRoot, "packages", "sdk"), join(pluginSdkScopeDir, "sdk"), "dir");

  writeFileSync(
    join(pluginsDir, "workspace-actions.ts"),
    readFileSync(join(repoRoot, ".pstdio", "plugins", "workspace-actions.ts"), "utf8"),
  );
  writeFileSync(join(composeDir, "compose.yaml"), "services:\n  prompt-studio:\n    image: oven/bun:1.3.10\n");

  writeFileSync(
    join(binDir, "docker"),
    `#!/bin/sh
set -eu
case " $* " in
  *" up -d "*)
  exit 0
  ;;
  *" port prompt-studio 5173 "*)
  printf '127.0.0.1:${dashboardPort}\n'
  exit 0
  ;;
  *" port prompt-studio 19841 "*)
  printf '127.0.0.1:${apiPort}\n'
  exit 0
  ;;
esac
echo "unexpected docker args: $*" >&2
exit 1
`,
  );
  chmodSync(join(binDir, "docker"), 0o755);

  process.env.PATH = `${binDir}:${previousPath ?? ""}`;

  ({ app, close } = await createApp({
    agents: [],
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Run project action test" }),
  });
  const project = await projectRes.json();
  projectId = project.id;

  const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-repo", path: repoPath }),
  });
  expect(repoRes.ok).toBeTrue();

  const ticketRes = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, user_prompt: "run project target" }),
  });
  const ticket = await ticketRes.json();

  const workspaceRes = await app.request("/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      ticket_id: ticket.id,
      ticket_shorthand: ticket.shorthand,
      worktree_path: repoPath,
    }),
  });
  const workspace = await workspaceRes.json();
  workspaceId = workspace.id;
});

afterAll(async () => {
  await close();

  if (previousPath === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = previousPath;
  }

  rmSync(tempRoot, { recursive: true, force: true });
});

describe("workspace-actions/run-project", () => {
  test("starts the dockerized workspace and returns the published URLs", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/workspace-actions%2Frun-project/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "workspace", target_id: workspaceId }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "success",
      message:
        `Project is starting at http://127.0.0.1:${dashboardPort}. ` +
        `API is available at http://127.0.0.1:${apiPort}.`,
    });
  });
});
