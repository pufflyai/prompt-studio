import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { createExtensionService } from "../../services/extension-service";
import { createTestApp } from "../../test-utils/create-test-app";
import { writeProvisionHarnessExtension } from "../../test-utils/write-provision-harness-extension";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { hashExtensionSource, loadExtensionSource } from "./extension-runtime";

type AppHandle = Awaited<ReturnType<typeof createTestApp>>;

const CLAUDE_CODE_ID = testHarnessId("claude-code");

const writeCatalogExtension = (root: string, options?: { escapeTemplate?: boolean }) => {
  const sourcePath = join(root, "catalog-extension");
  mkdirSync(join(sourcePath, "templates"), { recursive: true });
  mkdirSync(join(sourcePath, "skills", "lab-skill", "notes"), { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "test-catalog",
      version: "0.1.0",
      displayName: "Test Catalog",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(join(sourcePath, "templates", "lab-ticket.md"), "# Lab Ticket\n", "utf8");
  writeFileSync(join(sourcePath, "skills", "lab-skill", "SKILL.md"), "# Lab Skill\n", "utf8");
  writeFileSync(join(sourcePath, "skills", "lab-skill", "notes", "example.md"), "example\n", "utf8");
  writeFileSync(join(root, "outside.md"), "# Outside\n", "utf8");
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `const asset = (path: string) => ({ kind: "package-asset" as const, path, baseUrl: import.meta.url });

export default {
  templates: [
    {
      id: "catalogTicket",
      ref: { kind: "template", id: "catalogTicket" },
      title: "Catalog Ticket",
      type: "ticket",
      source: asset(${JSON.stringify(options?.escapeTemplate ? "../outside.md" : "./templates/lab-ticket.md")}),
    },
  ],
  skills: [
    {
      id: "catalogSkill",
      ref: { kind: "skill", id: "catalogSkill" },
      title: "Catalog Skill",
      description: "Skill from an extension directory.",
      source: asset("./skills/lab-skill"),
    },
  ],
};
`,
    "utf8",
  );
  return sourcePath;
};

const enableSource = async (
  extensionService: ReturnType<typeof createExtensionService>,
  projectId: string,
  sourcePath: string,
  installName: string,
) => {
  const loaded = await loadExtensionSource(sourcePath);
  return extensionService.enableInstalledSourceForProject({
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

// Enable a harness extension whose workspace.provision hook syncs skills into .claude/skills.
const enableProvisionHarness = (
  extensionService: ReturnType<typeof createExtensionService>,
  projectId: string,
  root: string,
) =>
  enableSource(
    extensionService,
    projectId,
    writeProvisionHarnessExtension(root, {
      installName: `provision-harness-${projectId}`,
      localId: "claude-code",
      skillsDir: ".claude/skills",
    }),
    `provision-harness-${projectId}`,
  );

const createProject = async (handle: AppHandle, name: string) => {
  const res = await handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  expect(res.status).toBe(201);
  return res.json() as Promise<{ id: string }>;
};

let handle: AppHandle;
let tempRoot: string;

beforeEach(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-catalog-test-"));
  handle = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("claude-code", { availability: "INSTALLED" })]),
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
  });
});

afterEach(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("extension-backed template catalog", () => {
  test("lists, reads, disables, and re-enables extension-backed templates", async () => {
    const project = await createProject(handle, "Template Catalog Project");
    const sourcePath = writeCatalogExtension(tempRoot);
    await enableSource(handle.deps.extensionService, project.id, sourcePath, "catalog");

    const listRes = await handle.app.request(`/v1/projects/${project.id}/templates`);
    expect(listRes.status).toBe(200);
    const templates = await listRes.json();
    const item = templates.find((template: { name: string }) => template.name === "catalog-ticket");
    expect(item).toMatchObject({
      source_kind: "extension",
      extension_id: "pstdio.test-catalog",
      key: "catalogTicket",
      name: "catalog-ticket",
      template_type: "ticket",
      title: "Catalog Ticket",
      enabled: true,
    });
    expect(item.file_id).toBeUndefined();

    const getRes = await handle.app.request(`/v1/projects/${project.id}/templates/catalog-ticket`);
    expect(getRes.status).toBe(200);
    const loaded = await getRes.json();
    expect(loaded.content).toBe("# Lab Ticket\n");

    const defaultRes = await handle.app.request(`/v1/projects/${project.id}/templates/catalog-ticket`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    expect(defaultRes.status).toBe(200);
    const updated = await defaultRes.json();
    expect(updated.source_kind).toBe("extension");
    expect(updated.is_default).toBe(true);

    const disableRes = await handle.app.request(`/v1/projects/${project.id}/templates/catalog-ticket`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(disableRes.status).toBe(200);

    const disabledListRes = await handle.app.request(`/v1/projects/${project.id}/templates`);
    const disabledTemplates = await disabledListRes.json();
    expect(disabledTemplates.some((template: { name: string }) => template.name === "catalog-ticket")).toBe(false);

    const enableRes = await handle.app.request(`/v1/projects/${project.id}/templates/catalog-ticket`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });
    expect(enableRes.status).toBe(200);

    const updateRes = await handle.app.request(`/v1/projects/${project.id}/templates/catalog-ticket`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "# Updated Lab Ticket\n" }),
    });
    expect(updateRes.status).toBe(200);
    const override = await updateRes.json();
    expect(override).toMatchObject({ source_kind: "project", name: "catalog-ticket" });
    expect(readFileSync(join(sourcePath, "templates", "lab-ticket.md"), "utf8")).toBe("# Lab Ticket\n");

    const overrideGetRes = await handle.app.request(`/v1/projects/${project.id}/templates/catalog-ticket`);
    const overrideGet = await overrideGetRes.json();
    expect(overrideGet).toMatchObject({ source_kind: "project", content: "# Updated Lab Ticket\n" });
  });

  test("edits installed extension template assets through an installed-extension scoped endpoint", async () => {
    const firstProject = await createProject(handle, "First Template Catalog Project");
    const secondProject = await createProject(handle, "Second Template Catalog Project");
    const sourcePath = writeCatalogExtension(tempRoot);
    await enableSource(handle.deps.extensionService, firstProject.id, sourcePath, "catalog");
    await enableSource(handle.deps.extensionService, secondProject.id, sourcePath, "catalog");

    const projectUpdateRes = await handle.app.request(`/v1/projects/${firstProject.id}/templates/catalog-ticket`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "# Updated Through Project Route\n" }),
    });
    expect(projectUpdateRes.status).toBe(200);
    const projectOverride = await projectUpdateRes.json();
    expect(projectOverride).toMatchObject({ source_kind: "project", name: "catalog-ticket" });
    expect(readFileSync(join(sourcePath, "templates", "lab-ticket.md"), "utf8")).toBe("# Lab Ticket\n");

    const updateRes = await handle.app.request("/v1/extensions/installed/catalog/templates/catalogTicket", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "# Updated Lab Ticket\n" }),
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated).toMatchObject({ installName: "catalog", key: "catalogTicket" });
    expect(readFileSync(join(sourcePath, "templates", "lab-ticket.md"), "utf8")).toBe("# Updated Lab Ticket\n");

    const firstGetRes = await handle.app.request(`/v1/projects/${firstProject.id}/templates/catalog-ticket`);
    const firstTemplate = await firstGetRes.json();
    expect(firstTemplate).toMatchObject({
      source_kind: "project",
      content: "# Updated Through Project Route\n",
    });

    const secondGetRes = await handle.app.request(`/v1/projects/${secondProject.id}/templates/catalog-ticket`);
    const secondTemplate = await secondGetRes.json();
    expect(secondTemplate).toMatchObject({
      source_kind: "extension",
      content: "# Updated Lab Ticket\n",
    });
  });
});

describe("extension-backed skill catalog", () => {
  test("lists extension-backed skills and installs directory skills into registered repos", async () => {
    const project = await createProject(handle, "Skill Catalog Project");
    const sourcePath = writeCatalogExtension(tempRoot);
    await enableSource(handle.deps.extensionService, project.id, sourcePath, "catalog");
    await enableProvisionHarness(handle.deps.extensionService, project.id, tempRoot);

    const listRes = await handle.app.request(`/v1/projects/${project.id}/skills`);
    expect(listRes.status).toBe(200);
    const skills = await listRes.json();
    expect(skills.find((skill: { name: string }) => skill.name === "catalog-skill")).toMatchObject({
      source_kind: "extension",
      extension_id: "pstdio.test-catalog",
      key: "catalogSkill",
      title: "Catalog Skill",
      enabled: true,
    });

    const getRes = await handle.app.request(`/v1/projects/${project.id}/skills/catalog-skill`);
    expect(getRes.status).toBe(200);
    const skill = await getRes.json();
    expect(skill.files.map((file: { path: string }) => file.path).sort()).toEqual(["SKILL.md", "notes/example.md"]);

    const disableRes = await handle.app.request(`/v1/projects/${project.id}/skills/catalog-skill`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(disableRes.status).toBe(200);

    const disabledListRes = await handle.app.request(`/v1/projects/${project.id}/skills`);
    const disabledSkills = await disabledListRes.json();
    expect(disabledSkills.some((entry: { name: string }) => entry.name === "catalog-skill")).toBe(false);

    const enableRes = await handle.app.request(`/v1/projects/${project.id}/skills/catalog-skill`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });
    expect(enableRes.status).toBe(200);

    await handle.app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: CLAUDE_CODE_ID }),
    });

    const repoPath = join(tempRoot, "repo");
    mkdirSync(repoPath, { recursive: true });
    const repoRes = await handle.app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "repo", path: repoPath }),
    });
    expect(repoRes.status).toBe(201);
    expect(readFileSync(join(repoPath, ".claude", "skills", "catalog-skill", "SKILL.md"), "utf8")).toBe(
      "# Lab Skill\n",
    );
    expect(existsSync(join(repoPath, ".claude", "skills", "catalog-skill", "notes", "example.md"))).toBe(true);
  });

  test("installs extension catalog skills to repos for available harnesses", async () => {
    await handle.close();
    handle = await createTestApp({
      harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("claude-code")]),
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "isolated-storage"),
    });

    const project = await createProject(handle, "Agent Setup Project");
    const sourcePath = writeCatalogExtension(tempRoot);
    await enableSource(handle.deps.extensionService, project.id, sourcePath, "catalog");
    await enableProvisionHarness(handle.deps.extensionService, project.id, tempRoot);

    const repoPath = join(tempRoot, "late-agent-repo");
    mkdirSync(repoPath, { recursive: true });
    const repoRes = await handle.app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "late-agent-repo", path: repoPath }),
    });
    expect(repoRes.status).toBe(201);
    expect(readFileSync(join(repoPath, ".claude", "skills", "catalog-skill", "SKILL.md"), "utf8")).toBe(
      "# Lab Skill\n",
    );
  });

  test("rejects extension template assets that escape the installed source root", async () => {
    const project = await createProject(handle, "Escape Project");
    const sourcePath = writeCatalogExtension(tempRoot, { escapeTemplate: true });
    await enableSource(handle.deps.extensionService, project.id, sourcePath, "catalog");

    const res = await handle.app.request(`/v1/projects/${project.id}/templates/catalog-ticket`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("outside installed extension source");
  });
});
