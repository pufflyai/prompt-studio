import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import { writeProvisionHarnessExtension } from "../../../test-utils/write-provision-harness-extension";
import type { AppBindings } from "../../../types";
import { hashExtensionSource, loadExtensionSource } from "../../extensions/extension-runtime";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../../harnesses/test-harness-registry";

type AppHandle = Awaited<ReturnType<typeof createApp>>;

let app: OpenAPIHono<AppBindings>;
let handle: AppHandle;
let tempRoot: string;
let previousDefaultExtensions: string | undefined;
let previousPstdioHome: string | undefined;

const repoDefaultInstallName = "repo-default-extension";

const writeRepoDefaultExtension = (sourcePath: string) => {
  mkdirSync(sourcePath, { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: repoDefaultInstallName,
      version: "1.0.0",
      displayName: "Repo Default Extension",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
      pstdio: { scope: "repo" },
      private: true,
      type: "module",
    }),
  );
  writeFileSync(join(sourcePath, "extension.ts"), "export default {};\n");
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-register-repo-test-"));
  const repoDefaultSourcePath = join(tempRoot, repoDefaultInstallName);
  writeRepoDefaultExtension(repoDefaultSourcePath);
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  previousPstdioHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify({
    defaultExtensions: [{ source: repoDefaultSourcePath, installName: repoDefaultInstallName, skipInstall: true }],
  });
  process.env.PSTDIO_HOME = join(tempRoot, "home");
  handle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: resolveTestFilesRoot(),
    extensionWebviewBuilds: false,
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("claude-code")]),
  });
  app = handle.app;
});

afterAll(async () => {
  await handle.close();
  if (previousPstdioHome === undefined) {
    delete process.env.PSTDIO_HOME;
  } else {
    process.env.PSTDIO_HOME = previousPstdioHome;
  }
  if (previousDefaultExtensions === undefined) {
    delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  } else {
    process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
  }
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
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(join(skillRoot, "SKILL.md"), "# Create Ticket\n", "utf8");
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `const asset = (path: string) => ({ kind: "package-asset" as const, path, baseUrl: import.meta.url });

export default {
  skills: [
    {
      id: "createTicket",
      ref: { kind: "skill", id: "createTicket" },
      title: "Create ticket",
      description: "Create a ticket.",
      source: asset("./skills/create-ticket"),
    },
  ],
};
`,
    "utf8",
  );
  return sourcePath;
};

const enableExtensionSource = async (target: AppHandle, projectId: string, sourcePath: string, installName: string) => {
  const loaded = await loadExtensionSource(sourcePath);
  await target.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    installName,
    displayName: loaded.metadata.displayName,
    extensionId: loaded.metadata.id,
    manifest: loaded.manifest,
    name: loaded.metadata.name,
    sourceHash: hashExtensionSource(sourcePath),
    sourcePath,
    version: loaded.metadata.version ?? null,
  });
};

const enableSkillExtension = (target: AppHandle, projectId: string, sourcePath: string) =>
  enableExtensionSource(target, projectId, sourcePath, "repo-skill-extension");

// Enable a harness extension whose workspace.provision hook syncs skills into .claude/skills.
const enableProvisionHarness = (target: AppHandle, projectId: string) =>
  enableExtensionSource(
    target,
    projectId,
    writeProvisionHarnessExtension(tempRoot, {
      installName: `provision-harness-${projectId}`,
      localId: "claude-code",
      skillsDir: ".claude/skills",
    }),
    `provision-harness-${projectId}`,
  );

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

const initGitRepo = (path: string, branch: string) => {
  mkdirSync(path, { recursive: true });
  const run = (args: string[]) => Bun.spawnSync(["git", ...args], { cwd: path });
  run(["init", "-b", branch]);
  run(["config", "user.email", "test@example.com"]);
  run(["config", "user.name", "Test"]);
  writeFileSync(join(path, "README.md"), "# test\n");
  run(["add", "."]);
  run(["commit", "-m", "init"]);
};

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

  test("installs extension-backed skills to repo for available harnesses", async () => {
    const project = await createProject("Skill Install Project");
    await enableSkillExtension(handle, project.id, writeSkillExtension(tempRoot));
    await enableProvisionHarness(handle, project.id);

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

    const repoPath = join(tempRoot, "custom-skill-repo");
    const customSkillPath = join(repoPath, ".claude", "skills", "create-ticket", "SKILL.md");
    mkdirSync(join(repoPath, ".claude", "skills", "create-ticket"), { recursive: true });
    writeFileSync(customSkillPath, "# Custom Skill");

    const res = await registerRepo(project.id, "custom-skill-repo", repoPath);

    expect(res.status).toBe(201);
    expect(readFileSync(customSkillPath, "utf8")).toBe("# Custom Skill");
  });

  test("installs extension-backed skills without any prior agent configuration", async () => {
    const isolatedRoot = mkdtempSync(join(tmpdir(), "pstdio-api-register-repo-agent-install-test-"));
    const handle = await createApp({
      harnessRegistry: createTestHarnessRegistry([
        createTestHarnessRecord("claude-code", { availability: "INSTALLED" }),
      ]),
      dbPath: ":memory:",
      storagePath: join(isolatedRoot, "storage"),
      filesRoot: resolveTestFilesRoot(),
      extensionWebviewBuilds: false,
    });

    try {
      const createRes = await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Auto Agent Project" }),
      });
      const project = await createRes.json();
      await enableSkillExtension(handle, project.id, writeSkillExtension(isolatedRoot));
      await enableExtensionSource(
        handle,
        project.id,
        writeProvisionHarnessExtension(isolatedRoot, {
          installName: "provision-harness-auto",
          localId: "claude-code",
          skillsDir: ".claude/skills",
        }),
        "provision-harness-auto",
      );

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

  test("materializes and syncs repo-default extensions", async () => {
    const project = await createProject("Repo Defaults Project");
    const repoPath = join(tempRoot, "repo-defaults-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await registerRepo(project.id, "repo-defaults-repo", repoPath);

    expect(res.status).toBe(201);
    const sourcePath = join(repoPath, ".pstdio", "extensions", repoDefaultInstallName);
    expect(existsSync(join(sourcePath, "package.json"))).toBe(true);

    const instances = await handle.deps.extensionService.listProjectExtensionInstances(project.id);
    expect(instances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          installedSource: expect.objectContaining({
            install_name: repoDefaultInstallName,
            source_kind: "local_path",
            source_path: sourcePath,
          }),
        }),
      ]),
    );
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

describe("POST /v1/projects/:id/repos - default workspace", () => {
  test("creates a default workspace pointing at the repo's current branch", async () => {
    const project = await createProject("Default Workspace Project");

    const repoPath = join(tempRoot, "default-ws-repo");
    initGitRepo(repoPath, "main");

    const res = await registerRepo(project.id, "default-ws-repo", repoPath);
    expect(res.status).toBe(201);

    const workspace = await handle.deps.workspaceService.getDefault(project.id);
    expect(workspace).not.toBeNull();
    expect(workspace!.is_default).toBe(true);
    expect(workspace!.worktree_path).toBeNull();
    expect(workspace!.branch).toBe("main");
    expect(workspace!.name).toBe("default-ws-repo");
  });

  test("reuses the default workspace across repeated registrations", async () => {
    const project = await createProject("Default Workspace Idempotent");

    const repoPath = join(tempRoot, "default-ws-idem-repo");
    initGitRepo(repoPath, "main");

    await registerRepo(project.id, "default-ws-idem-repo", repoPath);
    const first = await handle.deps.workspaceService.getDefault(project.id);

    await registerRepo(project.id, "default-ws-idem-repo", repoPath);
    const second = await handle.deps.workspaceService.getDefault(project.id);

    expect(first).not.toBeNull();
    expect(second!.id).toBe(first!.id);
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
