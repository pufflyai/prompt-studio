import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

const dashboardPort = 45173;
const apiPort = 45174;
const previousPath = process.env.PATH;
const previousDockerBin = process.env.PSTDIO_TEST_DOCKER_BIN;

let app: OpenAPIHono<AppBindings>;
let close: () => Promise<void>;
let tempRoot: string;
let projectId: string;
let workspaceId: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-run-project-action-"));
  const repoPath = join(tempRoot, "repo");
  const pstdioDir = join(repoPath, ".pstdio");
  const extensionDir = join(pstdioDir, "extensions", "workspace-actions");
  const composeDir = join(repoPath, "infra", "local");
  const binDir = join(tempRoot, "bin");

  mkdirSync(extensionDir, { recursive: true });
  mkdirSync(composeDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });

  execSync("git init", { cwd: repoPath, stdio: "ignore" });
  execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: "ignore" });
  execSync('git config user.name "Test"', { cwd: repoPath, stdio: "ignore" });
  writeFileSync(join(repoPath, "README.md"), "run project action test\n");
  execSync("git add README.md", { cwd: repoPath, stdio: "ignore" });
  execSync('git commit -m "init"', { cwd: repoPath, stdio: "ignore" });
  writeFileSync(join(composeDir, "compose.yaml"), "services:\n  prompt-studio:\n    image: oven/bun:1.3.10\n");
  writeFileSync(
    join(extensionDir, "extension.ts"),
    `import { spawnSync } from "node:child_process";

    const runDocker = (cwd, args) => {
      const result = spawnSync(process.env.PSTDIO_TEST_DOCKER_BIN ?? "docker", args, { cwd, encoding: "utf8" });
      if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || "Docker command failed.");
      }
      return result.stdout.trim();
    };

    const publishedUrl = (cwd, port) => {
      const published = runDocker(cwd, ["compose", "-f", "infra/local/compose.yaml", "port", "prompt-studio", port]);
      const separator = published.lastIndexOf(":");
      const host = separator === -1 ? "127.0.0.1" : published.slice(0, separator) || "127.0.0.1";
      const targetPort = separator === -1 ? published : published.slice(separator + 1);
      return "http://" + (host === "0.0.0.0" ? "127.0.0.1" : host) + ":" + targetPort;
    };

    export default {
      id: "project.workspace-actions",
      name: "Workspace Actions",
      commands: {
        runProject: {
          title: "Run project",
          target: "workspace",
          menus: [{ slot: "workspace.header.secondary" }],
          async run(ctx) {
            const worktreePath = ctx.target.metadata?.worktreePath;
            if (typeof worktreePath !== "string" || !worktreePath) {
              throw new Error("Workspace worktree path is required.");
            }

            runDocker(worktreePath, ["compose", "-f", "infra/local/compose.yaml", "up", "-d"]);
            const dashboardUrl = publishedUrl(worktreePath, "5173");
            const apiUrl = publishedUrl(worktreePath, "19841");

            return {
              message: "Project is starting at " + dashboardUrl + ". API is available at " + apiUrl + ".",
            };
          },
        },
      },
    };`,
  );

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
  process.env.PSTDIO_TEST_DOCKER_BIN = join(binDir, "docker");

  ({ app, close } = await createApp({
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

  const workspaceRes = await app.request("/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      name: "WS-RUN-PROJECT",
      anchors: [{ type: "pstdio.planner.ticket", id: "PS-1", label: "PS-1", extensionId: "pstdio.planner" }],
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

  if (previousDockerBin === undefined) {
    delete process.env.PSTDIO_TEST_DOCKER_BIN;
  } else {
    process.env.PSTDIO_TEST_DOCKER_BIN = previousDockerBin;
  }

  rmSync(tempRoot, { recursive: true, force: true });
});

describe("extension workspace run-project action", () => {
  test("starts the dockerized workspace and returns the published URLs", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/project.workspace-actions.runProject/execute`, {
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
