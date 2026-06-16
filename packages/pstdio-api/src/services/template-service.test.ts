import { describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionTemplatePreferencesDBService,
  createExtensionUserDataDBService,
  createFilesDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
  createProjectTemplateDefaultsDBService,
  createTemplatesDBService,
} from "pstdio-db";
import { createFilesStorageService } from "pstdio-storage";
import { createExtensionService } from "./extension-service";
import { createFileService } from "./file-service";
import { createProjectService } from "./project-service";
import { createTemplateService } from "./template-service";

// Writes a minimal installed-extension source that contributes a single
// prompt template, so the override path can be exercised end-to-end.
const writeExtensionWithTemplate = (root: string, templateKey: string) => {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "review-extension",
      version: "1.0.0",
      displayName: "Review Extension",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
  templates: {
    ${templateKey}: {
      title: "Review code",
      type: "prompt",
      source: { kind: "package-asset", path: "./review-code.md", baseUrl: import.meta.url },
    },
  },
};`,
  );
  writeFileSync(join(root, "review-code.md"), "EXTENSION CONTENT\n");
};

describe("TemplateService", () => {
  test("list returns project templates when no extensions are enabled", async () => {
    const templates = [
      {
        id: "t1",
        project_id: "p1",
        name: "default",
        template_type: "prompt",
        file_id: "f1",
        is_default: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
      },
    ];
    const list = mock(async () => templates);
    const service = createTemplateService({
      templatesDBService: { list },
      extensionService: { listEnabledSourcesForProject: mock(async () => []) },
      extensionTemplatePreferencesDBService: { list: mock(async () => []) },
      projectTemplateDefaultsDBService: { list: mock(async () => []) },
    } as unknown as Parameters<typeof createTemplateService>[0]);

    const result = await service.list("p1");

    expect(result[0]).toMatchObject({ id: "t1", source_kind: "project", title: "default" });
    expect(list).toHaveBeenCalledWith("p1");
  });

  test("editing an extension template's content applies metadata to the project override", async () => {
    const { db, close } = await createDb({ path: ":memory:" });
    const tempRoot = mkdtempSync(join(tmpdir(), "tpl-svc-override-"));
    const extensionRoot = join(tempRoot, "review-extension");
    writeExtensionWithTemplate(extensionRoot, "review_code");

    const projectService = createProjectService({ projectsDBService: createProjectsDBService(db) });
    const extensionService = createExtensionService({
      extensionInstancesService: createExtensionInstancesDBService(db),
      extensionUserDataService: createExtensionUserDataDBService(db),
      installedExtensionSourcesService: createInstalledExtensionSourcesDBService(db),
      projectService,
    });
    const fileService = createFileService({
      filesDBService: createFilesDBService(db),
      filesStorageService: createFilesStorageService(join(tempRoot, "storage")),
    });
    const service = createTemplateService({
      extensionService,
      extensionTemplatePreferencesDBService: createExtensionTemplatePreferencesDBService(db),
      fileService,
      projectTemplateDefaultsDBService: createProjectTemplateDefaultsDBService(db),
      templatesDBService: createTemplatesDBService(db),
    });

    const project = await projectService.create({ name: "Override Project" });
    await extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "review-extension",
      extensionId: "pstdio.review-extension",
      name: "review-extension",
      displayName: "Review Extension",
      sourceKind: "local_path",
      sourcePath: extensionRoot,
      manifest: {},
    });

    const before = await service.getWithContent(project.id, "review-code");
    expect(before).toMatchObject({ source_kind: "extension", content: "EXTENSION CONTENT\n" });

    const result = await service.update(project.id, "review-code", {
      content: "PROJECT OVERRIDE",
      is_default: true,
      title: "Custom review",
    });
    expect(result).toMatchObject({
      template: {
        source_kind: "project",
        name: "review-code",
        is_default: true,
        title: "Custom review",
      },
    });

    const after = await service.getWithContent(project.id, "review-code");
    expect(after).toMatchObject({
      source_kind: "project",
      template_type: "prompt",
      is_default: true,
      title: "Custom review",
      content: "PROJECT OVERRIDE",
    });

    await close();
    rmSync(tempRoot, { recursive: true, force: true });
  });
});
