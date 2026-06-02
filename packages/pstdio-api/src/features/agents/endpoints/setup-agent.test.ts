import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-setup-agent-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

const createGitRepo = (root: string, name: string) => {
  const repoRoot = join(root, name);
  mkdirSync(repoRoot, { recursive: true });
  execSync("git init", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "# test\n");
  execSync("git add README.md", { cwd: repoRoot, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
};

const coreExtensionSource = (name: string) => resolve(import.meta.dirname, "../../../../../../extensions", name);

const testDefaultExtensions = JSON.stringify({
  defaultExtensions: [
    { source: coreExtensionSource("pstdio-core-skills"), installName: "pstdio-core-skills", skipInstall: true },
    {
      source: coreExtensionSource("pstdio-core-worktree-automations"),
      installName: "pstdio-core-worktree-automations",
      skipInstall: true,
    },
  ],
});

describe("POST /v1/agents", () => {
  test("creates a new agent config", async () => {
    const res = await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.agent_id).toBe("claude-code");
    expect(body.is_default).toBe(true);
  });

  test("is idempotent for same agent_id", async () => {
    const res = await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.agent_id).toBe("claude-code");
  });

  test("second agent is not default", async () => {
    const res = await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "opencode" }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.agent_id).toBe("opencode");
    expect(body.is_default).toBe(false);
  });

  test("persists binary when creating an agent config manually", async () => {
    const res = await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code", binary: "/custom/bin/claude-code" }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    const config = JSON.parse(body.config);
    expect(config.binary).toBe("/custom/bin/claude-code");
  });

  test("keeps existing config values when adding binary", async () => {
    await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });

    await app.request("/v1/agents/claude-code", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ skills_dir: "/custom/skills" }),
    });

    const res = await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code", binary: "/custom/bin/claude-code" }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    const config = JSON.parse(body.config);
    expect(config.binary).toBe("/custom/bin/claude-code");
    expect(config.skills_dir).toBe("/custom/skills");
  });

  test("ignores missing repo-local extension sources when installing skills", async () => {
    const isolatedRoot = mkdtempSync(join(tmpdir(), "pstdio-api-setup-agent-missing-repo-"));
    const previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
    const previousHome = process.env.HOME;
    const previousPstdioHome = process.env.PSTDIO_HOME;

    process.env.PSTDIO_DEFAULT_EXTENSIONS = testDefaultExtensions;
    process.env.HOME = join(isolatedRoot, "home");
    process.env.PSTDIO_HOME = join(isolatedRoot, "home");
    mkdirSync(process.env.HOME, { recursive: true });

    const isolated = await createApp({
      dbPath: ":memory:",
      storagePath: join(isolatedRoot, "storage"),
      filesRoot: "",
    });

    try {
      const projectRes = await isolated.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "repo-local-skills" }),
      });
      const project = await projectRes.json();
      const repoPath = createGitRepo(isolatedRoot, "repo");

      await isolated.app.request(`/v1/projects/${project.id}/repos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "repo", path: repoPath }),
      });
      rmSync(repoPath, { recursive: true, force: true });

      const res = await isolated.app.request("/v1/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent_id: "claude-code" }),
      });

      expect(res.status).toBe(201);
      expect(existsSync(repoPath)).toBe(false);
    } finally {
      await isolated.close();
      rmSync(isolatedRoot, { recursive: true, force: true });
      if (previousDefaultExtensions === undefined) {
        delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
      } else {
        process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
      }
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
      if (previousPstdioHome === undefined) {
        delete process.env.PSTDIO_HOME;
      } else {
        process.env.PSTDIO_HOME = previousPstdioHome;
      }
    }
  });
});
