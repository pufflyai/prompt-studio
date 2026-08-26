import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createApp } from "../../app";
import type { createExtensionService } from "../../services/extension-service";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../harnesses/test-harness-registry";
import { hashExtensionSource, loadExtensionSource } from "./extension-runtime";

type AppHandle = Awaited<ReturnType<typeof createApp>>;

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
let previousPstdioHome: string | undefined;
let tempRoot: string;

beforeEach(async () => {
  previousPstdioHome = process.env.PSTDIO_HOME;
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-core-extension-catalog-test-"));
  process.env.PSTDIO_HOME = join(tempRoot, "home");
  handle = await createApp({
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("claude-code", { availability: "INSTALLED" })]),
    dbPath: ":memory:",
    extensionWebviewBuilds: false,
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  });
});

afterEach(async () => {
  await handle.close();
  if (previousPstdioHome === undefined) {
    delete process.env.PSTDIO_HOME;
  } else {
    process.env.PSTDIO_HOME = previousPstdioHome;
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("core extension catalog", () => {
  test("lists core extension templates and skills as extension-backed records", async () => {
    const project = await createProject(handle, "Core Catalog Project");
    await enableSource(
      handle.deps.extensionService,
      project.id,
      resolve(import.meta.dirname, "../../../../../extensions/pstdio-planner"),
      "pstdio-planner",
    );
    await enableSource(
      handle.deps.extensionService,
      project.id,
      resolve(import.meta.dirname, "../../../../../extensions/pstdio-skills"),
      "pstdio-skills",
    );
    const templatesRes = await handle.app.request(`/v1/projects/${project.id}/templates`);
    const templates = await templatesRes.json();
    expect(
      templates.some(
        (template: { install_name?: string; name: string; source_kind: string }) =>
          template.name === "implement-ticket" &&
          template.source_kind === "extension" &&
          template.install_name === "pstdio-planner",
      ),
    ).toBe(true);

    expect(
      templates.some(
        (template: { install_name?: string; name: string; source_kind: string }) =>
          template.name === "prd" && template.source_kind === "extension" && template.install_name === "pstdio-planner",
      ),
    ).toBe(true);

    const skillsRes = await handle.app.request(`/v1/projects/${project.id}/skills`);
    const skills = await skillsRes.json();
    expect(
      skills.some(
        (skill: { install_name?: string; name: string; source_kind: string }) =>
          skill.name === "create-ticket" &&
          skill.source_kind === "extension" &&
          skill.install_name === "pstdio-planner",
      ),
    ).toBe(true);

    expect(
      skills.some(
        (skill: { install_name?: string; name: string; source_kind: string }) =>
          skill.name === "create-pstdio-extension" &&
          skill.source_kind === "extension" &&
          skill.install_name === "pstdio-skills",
      ),
    ).toBe(true);

    expect(
      skills.some(
        (skill: { install_name?: string; name: string; source_kind: string }) =>
          skill.name === "create-pstdio-extension" && skill.install_name === "pstdio-planner",
      ),
    ).toBe(false);

    const coreExtensionSkillRes = await handle.app.request(`/v1/projects/${project.id}/skills/create-pstdio-extension`);
    expect(coreExtensionSkillRes.status).toBe(200);
    const coreExtensionSkill = await coreExtensionSkillRes.json();
    expect(coreExtensionSkill.files.map((file: { path: string }) => file.path).sort()).toEqual([
      "SKILL.md",
      "references/examples.md",
      "references/extension-api.md",
      "references/scope.md",
      "references/validation.md",
    ]);
  });
});
