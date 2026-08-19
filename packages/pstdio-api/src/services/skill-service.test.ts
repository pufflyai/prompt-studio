import { describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionSkillPreferencesDBService,
  createExtensionTemplatePreferencesDBService,
  createExtensionUserDataDBService,
  createFilesDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
  createProjectTemplateDefaultsDBService,
  createReposDBService,
  createSkillsDBService,
  createTemplatesDBService,
} from "pstdio-db";
import { createFilesStorageService } from "pstdio-storage";
import { createProjectExtensionRuntimeCatalog } from "../features/extensions/project-extension-runtime-catalog";
import { createExtensionService } from "./extension-service";
import { createFileService } from "./file-service";
import { createProjectService } from "./project-service";
import { createRepoService } from "./repo-service";
import { createSkillService } from "./skill-service";
import { createTemplateService } from "./template-service";

const emptyRuntime = {
  artifactMounts: [],
  cli: [],
  commandPaletteResources: [],
  commands: [],
  controlsRenderers: [],
  dataTableRenderers: [],
  diagnostics: [],
  extensions: [],
  fileIconThemes: [],
  fileRenderers: [],
  harnesses: [],
  hooks: [],
  kanbanRenderers: [],
  keybindings: [],
  middlewares: [],
  modes: [],
  panels: [],
  routes: [],
  schedules: [],
  settings: [],
  settingsPanels: [],
  settingsSections: [],
  skills: [],
  templateTypes: [],
  templates: [],
  themes: [],
  translations: [],
  treeItems: [],
  treeRenderers: [],
  workspaceTypes: [],
};

const writeExtensionWithSkill = (root: string, importCountPath: string) => {
  mkdirSync(join(root, "skill"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "skill-extension",
      version: "1.0.0",
      displayName: "Skill Extension",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `const countPath = ${JSON.stringify(importCountPath)};
const currentCount = Number(await Bun.file(countPath).text().catch(() => "0"));
await Bun.write(countPath, String(currentCount + 1));

export default {
  skills: {
    review_code: {
      title: "Review code",
      description: "Review code changes",
      source: { kind: "package-asset", path: "./skill", baseUrl: import.meta.url },
    },
  },
};`,
  );
  writeFileSync(join(root, "skill", "SKILL.md"), "Review code changes\n");
};

const fakeFileService = {
  get: mock(async () => ({ storage_path: "/dev/null" })),
  upload: mock(async () => ({ id: "f1" })),
  remove: mock(async () => true),
} as unknown as Parameters<typeof createSkillService>[0]["fileService"];

const fakeExtensionDeps = {
  extensionRuntimeCatalog: { get: mock(async () => ({ enabledSources: [], runtime: emptyRuntime })) },
  extensionSkillPreferencesDBService: { list: mock(async () => []) },
} as unknown as Pick<
  Parameters<typeof createSkillService>[0],
  "extensionRuntimeCatalog" | "extensionSkillPreferencesDBService"
>;

describe("SkillService", () => {
  test("list hydrates file content via fileService", async () => {
    const list = mock(async () => [
      {
        id: "sk1",
        project_id: "p1",
        name: "test-skill",
        description: "",
        files: [{ path: "SKILL.md", file_id: "f1" }],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
      },
    ]);
    const service = createSkillService({
      ...fakeExtensionDeps,
      skillsDBService: { list } as unknown as Parameters<typeof createSkillService>[0]["skillsDBService"],
      fileService: fakeFileService,
    });

    const result = await service.list("p1");

    expect(result).toHaveLength(1);
    expect(result[0]?.files[0]?.path).toBe("SKILL.md");
    expect(list).toHaveBeenCalled();
  });

  test("list reads extension skills from the runtime snapshot without re-importing", async () => {
    const { close, importCountPath, project, service, tempRoot } = await setupServiceWithExtension();
    expect(await service.list(project.id)).toHaveLength(1);
    expect(await service.list(project.id)).toHaveLength(1);
    expect(await Bun.file(importCountPath).text()).toBe("1");

    await close();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("concurrent list reads share one module import per source", async () => {
    const { close, importCountPath, project, service, tempRoot } = await setupServiceWithExtension();
    const [first, second, third] = await Promise.all([
      service.list(project.id),
      service.list(project.id),
      service.list(project.id),
    ]);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(third).toHaveLength(1);
    expect(await Bun.file(importCountPath).text()).toBe("1");

    await close();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("skill and template reads share one snapshot from the same catalog", async () => {
    const { catalog, close, db, fileService, importCountPath, project, service, tempRoot } =
      await setupServiceWithExtension();
    const templateService = createTemplateService({
      extensionRuntimeCatalog: catalog,
      extensionTemplatePreferencesDBService: createExtensionTemplatePreferencesDBService(db),
      fileService: fileService as never,
      projectTemplateDefaultsDBService: createProjectTemplateDefaultsDBService(db),
      templatesDBService: createTemplatesDBService(db),
    });

    const before = await catalog.get(project.id);
    await Promise.all([service.list(project.id), templateService.list(project.id)]);

    // Both services read the one published snapshot; the source imported once.
    expect(await catalog.get(project.id)).toBe(before);
    expect(await Bun.file(importCountPath).text()).toBe("1");

    await close();
    rmSync(tempRoot, { recursive: true, force: true });
  });
});

const setupServiceWithExtension = async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  const tempRoot = mkdtempSync(join(tmpdir(), "skill-svc-runtime-"));
  const extensionRoot = join(tempRoot, "skill-extension");
  const importCountPath = join(tempRoot, "imports.txt");
  writeExtensionWithSkill(extensionRoot, importCountPath);

  const projectService = createProjectService({ projectsDBService: createProjectsDBService(db) });
  const repoService = createRepoService({ reposDBService: createReposDBService(db) });
  const extensionService = createExtensionService({
    extensionInstancesService: createExtensionInstancesDBService(db),
    extensionUserDataService: createExtensionUserDataDBService(db),
    installedExtensionSourcesService: createInstalledExtensionSourcesDBService(db),
    projectService,
  });
  const catalog = createProjectExtensionRuntimeCatalog({ extensionService, projectService, repoService });
  const fileService = createFileService({
    filesDBService: createFilesDBService(db),
    filesStorageService: createFilesStorageService(join(tempRoot, "storage")),
  });
  const service = createSkillService({
    extensionRuntimeCatalog: catalog,
    extensionSkillPreferencesDBService: createExtensionSkillPreferencesDBService(db),
    fileService,
    skillsDBService: createSkillsDBService(db),
  });

  const project = await projectService.create({ name: "Runtime Project" });
  await extensionService.enableInstalledSourceForProject({
    projectId: project.id,
    installName: "skill-extension",
    extensionId: "pstdio.skill-extension",
    name: "skill-extension",
    displayName: "Skill Extension",
    sourceKind: "local_path",
    sourcePath: extensionRoot,
    manifest: {},
  });

  return { catalog, close, db, fileService, importCountPath, project, service, tempRoot };
};
