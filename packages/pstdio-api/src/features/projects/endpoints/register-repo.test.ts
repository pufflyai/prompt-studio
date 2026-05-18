import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AgentId, AgentService, AvailabilityInfo } from "pstdio-agents";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import type { AppBindings } from "../../../types";
import { hashExtensionSource, loadExtensionSource } from "../../extensions/extension-runtime";

type AppHandle = Awaited<ReturnType<typeof createApp>>;

let app: OpenAPIHono<AppBindings>;
let handle: AppHandle;
let tempRoot: string;

const createTestAgent = (id: AgentId, availability: AvailabilityInfo): AgentService =>
  ({
    id,
    name: id,
    capabilities: () => [],
    checkAvailability: () => availability,
    listModels: () => [],
    startSession: async () => ({}),
    resumeSession: async () => ({}),
    getMessages: async () => [],
    listSessions: async () => [],
    exportSession: async () => ({ session: { id: "session", title: "Session" }, messages: [] }),
    launchSession: async () => ({}),
  }) as unknown as AgentService;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-register-repo-test-"));
  handle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: resolveTestFilesRoot(),
  });
  app = handle.app;
});

afterAll(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

const writeSkillExtension = (root: string) => {
  const sourcePath = join(root, "repo-skill-extension");
  const skillRoot = join(sourcePath, "skills", "create-ticket");
  mkdirSync(skillRoot, { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "test-repo-skill",
      version: "1.0.0",
      displayName: "Test Repo Skill",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(join(skillRoot, "SKILL.md"), "# Create Ticket\n", "utf8");
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `const asset = (path: string) => ({ kind: "package-asset" as const, path, baseUrl: import.meta.url });

export default {
  skills: {
    createTicket: {
      title: "Create ticket",
      description: "Create a ticket.",
      source: asset("./skills/create-ticket"),
    },
  },
};
`,
    "utf8",
  );
  return sourcePath;
};

const enableSkillExtension = async (target: AppHandle, projectId: string, sourcePath: string) => {
  const loaded = await loadExtensionSource(sourcePath);
  await target.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    installName: "repo-skill-extension",
    displayName: loaded.metadata.displayName,
    extensionId: loaded.metadata.id,
    manifest: loaded.manifest,
    name: loaded.metadata.name,
    sourceHash: hashExtensionSource(sourcePath),
    sourcePath,
    version: loaded.metadata.version ?? null,
  });
};

const createProject = async (name: string) => {
  const response = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });

  return response.json();
};

const registerRepo = (projectId: string, name: string, path: string, extraBody?: Record<string, unknown>) =>
  app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, path, ...extraBody }),
  });

describe("POST /v1/projects/:id/repos - basic behavior", () => {
  test("registers a repo and links it to the project", async () => {
    const project = await createProject("Test Project");

    const repoPath = join(tempRoot, "my-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await registerRepo(project.id, "my-repo", repoPath);

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe("my-repo");
    expect(body.path).toBe(repoPath);
  });

  test("returns 404 for non-existent project", async () => {
    const res = await app.request("/v1/projects/nonexistent/repos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "my-repo", path: "/home/user/my-repo" }),
    });

    expect(res.status).toBe(404);
  });

  test("returns 400 when body contains unknown keys", async () => {
    const project = await createProject("Strict Repo Project");

    const repoPath = join(tempRoot, "strict-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await registerRepo(project.id, "strict-repo", repoPath, { unknown_key: "value" });

    expect(res.status).toBe(400);
  });

  test("installs extension-backed skills to repo for configured agents", async () => {
    const project = await createProject("Skill Install Project");
    await enableSkillExtension(handle, project.id, writeSkillExtension(tempRoot));

    await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });

    const repoPath = join(tempRoot, "skill-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await registerRepo(project.id, "skill-repo", repoPath);

    expect(res.status).toBe(201);

    const skillsDir = join(repoPath, ".claude", "skills");
    expect(existsSync(skillsDir)).toBe(true);
    expect(readdirSync(skillsDir).length).toBeGreaterThan(0);
  });

  test("preserves existing repo-local skill customizations", async () => {
    const project = await createProject("Skill Customization Project");
    await enableSkillExtension(handle, project.id, writeSkillExtension(tempRoot));

    await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });

    const repoPath = join(tempRoot, "custom-skill-repo");
    const customSkillPath = join(repoPath, ".claude", "skills", "create-ticket", "SKILL.md");
    mkdirSync(join(repoPath, ".claude", "skills", "create-ticket"), { recursive: true });
    writeFileSync(customSkillPath, "# Custom Skill");

    const res = await registerRepo(project.id, "custom-skill-repo", repoPath);

    expect(res.status).toBe(201);
    expect(readFileSync(customSkillPath, "utf8")).toBe("# Custom Skill");
  });

  test("auto-configures the first installed agent before installing extension-backed skills", async () => {
    const isolatedRoot = mkdtempSync(join(tmpdir(), "pstdio-api-register-repo-agent-install-test-"));
    const handle = await createApp({
      agents: [createTestAgent("claude-code", { type: "INSTALLED" })],
      dbPath: ":memory:",
      storagePath: join(isolatedRoot, "storage"),
      filesRoot: resolveTestFilesRoot(),
    });

    try {
      const createRes = await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Auto Agent Project" }),
      });
      const project = await createRes.json();
      await enableSkillExtension(handle, project.id, writeSkillExtension(isolatedRoot));

      const repoPath = join(isolatedRoot, "auto-agent-repo");
      mkdirSync(repoPath, { recursive: true });

      const res = await handle.app.request(`/v1/projects/${project.id}/repos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "auto-agent-repo", path: repoPath }),
      });

      expect(res.status).toBe(201);
      const skillsDir = join(repoPath, ".claude", "skills");
      expect(existsSync(skillsDir)).toBe(true);
      expect(readdirSync(skillsDir).length).toBeGreaterThan(0);

      const agentsRes = await handle.app.request("/v1/agents");
      expect(agentsRes.status).toBe(200);
      expect(await agentsRes.json()).toEqual([
        expect.objectContaining({
          agent_id: "claude-code",
          is_default: true,
        }),
      ]);
    } finally {
      await handle.close();
      rmSync(isolatedRoot, { recursive: true, force: true });
    }
  });
});

describe("POST /v1/projects/:id/repos - repo bootstrap", () => {
  test("writes .pstdio/config.json with project_id", async () => {
    const project = await createProject("Config Project");

    const repoPath = join(tempRoot, "config-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await registerRepo(project.id, "config-repo", repoPath);

    expect(res.status).toBe(201);

    const configPath = join(repoPath, ".pstdio", "config.json");
    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, "utf8"));
    expect(config.project_id).toBe(project.id);
  });

  test("scaffolds the default starter plugins", async () => {
    const project = await createProject("Hook Project");

    const repoPath = join(tempRoot, "hook-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await registerRepo(project.id, "hook-repo", repoPath);

    expect(res.status).toBe(201);

    const pluginDir = join(repoPath, ".pstdio", "plugins");
    expect(existsSync(pluginDir)).toBe(true);
    expect(readdirSync(pluginDir).sort()).toEqual([
      "code-review-lifecycle.ts",
      "ticket-actions.ts",
      "ticket-lifecycle.ts",
      "workspace-actions.ts",
      "worktree-lifecycle.ts",
    ]);
  });

  test("overrides stale config when the linked project no longer exists and clears local tickets", async () => {
    const project = await createProject("Relink Target");

    const repoPath = join(tempRoot, "stale-config-repo");
    const stalePstdioDir = join(repoPath, ".pstdio");
    const staleTicketsDir = join(stalePstdioDir, "tickets", "PS-1_stale-ticket");
    const staleConfigPath = join(stalePstdioDir, "config.json");

    mkdirSync(staleTicketsDir, { recursive: true });
    writeFileSync(staleConfigPath, `${JSON.stringify({ project_id: "missing-project-id" }, null, 2)}\n`);
    writeFileSync(join(staleTicketsDir, "ticket.md"), "# stale ticket\n");

    const res = await registerRepo(project.id, "stale-config-repo", repoPath);

    expect(res.status).toBe(201);
    expect(existsSync(join(repoPath, ".pstdio", "tickets"))).toBe(false);

    const config = JSON.parse(readFileSync(staleConfigPath, "utf8"));
    expect(config.project_id).toBe(project.id);
  });
});

describe("POST /v1/projects/:id/repos - conflicts and idempotency", () => {
  test("returns 409 when repo is already linked to a different project", async () => {
    const projectA = await createProject("Project A");
    const projectB = await createProject("Project B");

    const repoPath = join(tempRoot, "conflict-repo");
    mkdirSync(repoPath, { recursive: true });

    const first = await registerRepo(projectA.id, "conflict-repo", repoPath);
    expect(first.status).toBe(201);

    const second = await registerRepo(projectB.id, "conflict-repo", repoPath);
    expect(second.status).toBe(409);

    const body = await second.json();
    expect(body.error).toContain("already linked");
  });

  test("is idempotent for same repo path", async () => {
    const project = await createProject("Idempotent Test");

    const repoPath = join(tempRoot, "same-repo");
    mkdirSync(repoPath, { recursive: true });

    const first = await registerRepo(project.id, "my-repo", repoPath);
    const firstBody = await first.json();

    const second = await registerRepo(project.id, "my-repo", repoPath);
    const secondBody = await second.json();

    expect(secondBody.id).toBe(firstBody.id);
  });
});
