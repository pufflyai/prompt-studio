import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import { writeProvisionHarnessExtension } from "../../../test-utils/write-provision-harness-extension";
import type { AppBindings } from "../../../types";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../../harnesses/test-harness-registry";
import { hashExtensionSource, loadExtensionSource } from "../extension-runtime";
import { createTestExtensionSource, createTestSkillExtensionSource } from "../test-utils/create-test-extension-source";

type AppHandle = Awaited<ReturnType<typeof createApp>>;

let app: OpenAPIHono<AppBindings>;
let handle: AppHandle;
let originalDefaultExtensions: string | undefined;
let originalPstdioHome: string | undefined;
let pstdioHome: string;
let tempRoot: string;
let counter = 0;

beforeAll(async () => {
  originalDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  originalPstdioHome = process.env.PSTDIO_HOME;
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-uninstall-project-extension-test-"));
  pstdioHome = join(tempRoot, "pstdio-home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_HOME = pstdioHome;
  handle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: resolveTestFilesRoot(),
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("claude-code")]),
  });
  app = handle.app;
});

afterAll(async () => {
  await handle.close();
  if (originalDefaultExtensions === undefined) {
    delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  } else {
    process.env.PSTDIO_DEFAULT_EXTENSIONS = originalDefaultExtensions;
  }
  if (originalPstdioHome === undefined) {
    delete process.env.PSTDIO_HOME;
  } else {
    process.env.PSTDIO_HOME = originalPstdioHome;
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

const createProject = async (name: string) => {
  const response = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return response.json();
};

const seedEnabledInstance = async (projectId: string) => {
  counter += 1;
  const installName = `uninstall-source-${counter}`;
  const name = `test-uninstall-${counter}`;
  const extensionId = `test.uninstall-${counter}`;
  const displayName = `Uninstall ${counter}`;
  const sourcePath = createTestExtensionSource({
    displayName,
    installName,
    name,
    root: pstdioHome,
    version: "1.0.0",
  });

  const result = await handle.deps.extensionService.enableInstalledSourceForProject({
    displayName,
    extensionId,
    installName,
    manifest: { id: extensionId, name, displayName },
    name,
    projectId,
    sourcePath,
    version: "1.0.0",
  });

  return {
    instanceId: result.instance.id,
    installedExtensionId: result.installedSource.id,
    installName,
    sourcePath,
  };
};

const seedEnabledSkillInstance = async (projectId: string) => {
  counter += 1;
  const installName = `uninstall-skill-source-${counter}`;
  const sourcePath = createTestSkillExtensionSource({
    displayName: `Uninstall Skill ${counter}`,
    installName,
    name: `test-uninstall-skill-${counter}`,
    root: pstdioHome,
    skillKey: "lab",
    version: "1.0.0",
  });
  const loaded = await loadExtensionSource(sourcePath);
  const result = await handle.deps.extensionService.enableInstalledSourceForProject({
    displayName: loaded.metadata.displayName,
    extensionId: loaded.metadata.id,
    installName,
    manifest: loaded.manifest,
    name: loaded.metadata.name,
    projectId,
    sourceHash: hashExtensionSource(sourcePath),
    sourcePath,
    version: loaded.metadata.version ?? null,
  });

  return { instanceId: result.instance.id };
};

// Enable a harness extension whose workspace.provision hook syncs skills into .claude/skills,
// so provisioning materializes (and prunes) the agent dir like the real harness extensions.
const enableProvisionHarness = async (projectId: string) => {
  const sourcePath = writeProvisionHarnessExtension(pstdioHome, {
    installName: `provision-harness-${projectId}`,
    localId: "claude-code",
    skillsDir: ".claude/skills",
  });
  const loaded = await loadExtensionSource(sourcePath);
  await handle.deps.extensionService.enableInstalledSourceForProject({
    displayName: loaded.metadata.displayName,
    extensionId: loaded.metadata.id,
    installName: `provision-harness-${projectId}`,
    manifest: loaded.manifest,
    name: loaded.metadata.name,
    projectId,
    sourceHash: hashExtensionSource(sourcePath),
    sourcePath,
    version: loaded.metadata.version ?? null,
  });
};

const registerClaudeRepo = async (projectId: string, name: string) => {
  const repoPath = join(tempRoot, name);
  mkdirSync(repoPath, { recursive: true });
  const res = await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, path: repoPath }),
  });
  expect(res.status).toBe(201);

  return repoPath;
};

describe("DELETE /v1/projects/:projectId/extensions/:instanceId", () => {
  test("removes the extension and installed source files", async () => {
    const project = await createProject("Uninstall Project");
    const { instanceId, installName, sourcePath } = await seedEnabledInstance(project.id);
    expect(existsSync(sourcePath)).toBe(true);

    const res = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}`, { method: "DELETE" });
    expect(res.status).toBe(204);

    const listRes = await app.request(`/v1/projects/${project.id}/extensions`);
    const list = await listRes.json();
    expect(list.extensions.find((entry: { id: string }) => entry.id === instanceId)).toBeUndefined();

    const stillInstalled = await handle.deps.extensionService.getInstalledSource(installName);
    expect(stillInstalled).toBeNull();
    expect(existsSync(sourcePath)).toBe(false);
  });

  test("removes extension skills from configured agent repos", async () => {
    const project = await createProject("Uninstall Skill Project");
    await enableProvisionHarness(project.id);
    const { instanceId } = await seedEnabledSkillInstance(project.id);
    const repoPath = await registerClaudeRepo(project.id, "uninstall-skill-repo");
    const skillPath = join(repoPath, ".claude", "skills", "lab", "SKILL.md");
    expect(existsSync(skillPath)).toBe(true);

    const res = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}`, { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(existsSync(skillPath)).toBe(false);
  });

  const seedTicket = async (projectId: string, instanceId: string) => {
    await handle.deps.extensionStorageService.setCollectionItem({
      extension_instance_id: instanceId,
      scope_type: "project",
      scope_id: projectId,
      collection: "tickets",
      item_id: "T-1",
      value_json: { title: "Keep me" },
      project_id: projectId,
    });
  };

  const listTickets = (projectId: string, instanceId: string) =>
    handle.deps.extensionStorageService.listCollection({
      extension_instance_id: instanceId,
      scope_type: "project",
      scope_id: projectId,
      collection: "tickets",
    });

  test("preserves user data by default and retains a disabled instance", async () => {
    const project = await createProject("Uninstall Keep Data");
    const { instanceId, installName, sourcePath } = await seedEnabledInstance(project.id);
    await seedTicket(project.id, instanceId);

    const res = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}`, { method: "DELETE" });
    expect(res.status).toBe(204);

    // Source files are gone (uninstalled) but the user's tickets and a disabled instance survive.
    expect(existsSync(sourcePath)).toBe(false);
    expect(await listTickets(project.id, instanceId)).toHaveLength(1);
    const instance = await handle.deps.extensionInstancesService.get(instanceId);
    expect(instance?.enabled).toBe(false);
    expect(await handle.deps.extensionService.getInstalledSource(installName)).not.toBeNull();
  });

  test("deletes user data and the instance when deleteUserData=true", async () => {
    const project = await createProject("Uninstall Drop Data");
    const { instanceId, installName, sourcePath } = await seedEnabledInstance(project.id);
    await seedTicket(project.id, instanceId);

    const res = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}?deleteUserData=true`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);

    expect(existsSync(sourcePath)).toBe(false);
    expect(await handle.deps.extensionInstancesService.get(instanceId)).toBeNull();
    expect(await listTickets(project.id, instanceId)).toHaveLength(0);
    expect(await handle.deps.extensionService.getInstalledSource(installName)).toBeNull();
  });

  test("returns 404 when the instance belongs to another project", async () => {
    const owner = await createProject("Uninstall Owner");
    const stranger = await createProject("Uninstall Stranger");
    const { instanceId } = await seedEnabledInstance(owner.id);

    const res = await app.request(`/v1/projects/${stranger.id}/extensions/${instanceId}`, { method: "DELETE" });
    expect(res.status).toBe(404);

    const listRes = await app.request(`/v1/projects/${owner.id}/extensions`);
    const list = await listRes.json();
    expect(list.extensions.find((entry: { id: string }) => entry.id === instanceId)).toBeDefined();
  });

  test("returns 404 for unknown instance id", async () => {
    const project = await createProject("Uninstall Missing");

    const res = await app.request(`/v1/projects/${project.id}/extensions/${crypto.randomUUID()}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
