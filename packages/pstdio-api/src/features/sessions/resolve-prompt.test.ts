import { describe, expect, test } from "bun:test";
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
  createReposDBService,
  createTemplatesDBService,
} from "pstdio-db";
import { createFilesStorageService } from "pstdio-storage";
import { createExtensionService } from "../../services/extension-service";
import { createFileService } from "../../services/file-service";
import { createProjectService } from "../../services/project-service";
import { createRepoService } from "../../services/repo-service";
import { createTemplateService } from "../../services/template-service";
import { createProjectExtensionRuntimeCatalog } from "../extensions/project-extension-runtime-catalog";
import { resolvePrompt } from "./resolve-prompt";

const createMockDeps = (
  overrides: { template?: { id: string; content: string } | null; fileContent?: string | null } = {},
) => ({
  templateService: {
    getWithContent: async (_projectId: string, _name: string) =>
      overrides.template ??
      (overrides.fileContent !== undefined ? { id: "t1", content: overrides.fileContent ?? "" } : null),
  },
  filesRoot: "",
});

// Writes a minimal installed-extension source that contributes a prompt
// template and records every module import, so the snapshot-backed read
// path can be exercised end-to-end.
const writeExtensionWithTemplate = (root: string, importCountPath: string) => {
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
    `const countPath = ${JSON.stringify(importCountPath)};
const currentCount = Number(await Bun.file(countPath).text().catch(() => "0"));
await Bun.write(countPath, String(currentCount + 1));

export default {
  templates: {
    review_code: {
      title: "Review code",
      type: "prompt",
      source: { kind: "package-asset", path: "./review-code.md", baseUrl: import.meta.url },
    },
  },
};`,
  );
  writeFileSync(join(root, "review-code.md"), "Fix issues in {{ticket}}/review.md\n");
};

describe("resolvePrompt", () => {
  test("returns prompt as-is when prompt is provided", async () => {
    const result = await resolvePrompt({ prompt: "do the thing" }, "project-1", createMockDeps());
    expect(result).toBe("do the thing");
  });

  test("resolves template by name and renders with vars", async () => {
    const result = await resolvePrompt(
      { template: "fix-it", vars: { ticket: "PS-7" } },
      "project-1",
      createMockDeps({
        template: { id: "t1", content: "Fix issues in {{ticket}}/review.md" },
        fileContent: "Fix issues in {{ticket}}/review.md",
      }),
    );
    expect(result).toBe("Fix issues in PS-7/review.md");
  });

  test("throws when template is not found", async () => {
    expect(
      resolvePrompt({ template: "nonexistent" }, "project-1", createMockDeps({ template: null })),
    ).rejects.toMatchObject({
      message: "Prompt template not found: nonexistent",
      status: 404,
    });
  });

  test("throws when both prompt and template are provided", async () => {
    expect(resolvePrompt({ prompt: "inline", template: "tpl" }, "project-1", createMockDeps())).rejects.toMatchObject({
      message: "--prompt and --template are mutually exclusive",
      status: 400,
    });
  });

  test("renders template with multiple variables", async () => {
    const result = await resolvePrompt(
      { template: "multi", vars: { error: "segfault", ticket: "PS-3" } },
      "project-1",
      createMockDeps({
        template: { id: "t1", content: "Error: {{error}} in {{ticket}}" },
        fileContent: "Error: {{error}} in {{ticket}}",
      }),
    );
    expect(result).toBe("Error: segfault in PS-3");
  });

  test("renders template with no vars (empty interpolation)", async () => {
    const result = await resolvePrompt(
      { template: "simple" },
      "project-1",
      createMockDeps({
        template: { id: "t1", content: "No variables here" },
        fileContent: "No variables here",
      }),
    );
    expect(result).toBe("No variables here");
  });

  test("reaches extension template content through the runtime snapshot without re-importing", async () => {
    const { db, close } = await createDb({ path: ":memory:" });
    const tempRoot = mkdtempSync(join(tmpdir(), "resolve-prompt-runtime-"));
    const extensionRoot = join(tempRoot, "review-extension");
    const importCountPath = join(tempRoot, "imports.txt");
    writeExtensionWithTemplate(extensionRoot, importCountPath);

    const projectService = createProjectService({ projectsDBService: createProjectsDBService(db) });
    const repoService = createRepoService({ reposDBService: createReposDBService(db) });
    const extensionService = createExtensionService({
      extensionInstancesService: createExtensionInstancesDBService(db),
      extensionUserDataService: createExtensionUserDataDBService(db),
      installedExtensionSourcesService: createInstalledExtensionSourcesDBService(db),
      projectService,
    });
    const templateService = createTemplateService({
      extensionRuntimeCatalog: createProjectExtensionRuntimeCatalog({ extensionService, repoService }),
      extensionTemplatePreferencesDBService: createExtensionTemplatePreferencesDBService(db),
      fileService: createFileService({
        filesDBService: createFilesDBService(db),
        filesStorageService: createFilesStorageService(join(tempRoot, "storage")),
      }),
      projectTemplateDefaultsDBService: createProjectTemplateDefaultsDBService(db),
      templatesDBService: createTemplatesDBService(db),
    });

    const project = await projectService.create({ name: "Runtime Project" });
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

    const deps = { templateService, filesRoot: "" };
    expect(await resolvePrompt({ template: "review-code", vars: { ticket: "PS-7" } }, project.id, deps)).toBe(
      "Fix issues in PS-7/review.md\n",
    );
    expect(await resolvePrompt({ template: "review-code", vars: { ticket: "PS-9" } }, project.id, deps)).toBe(
      "Fix issues in PS-9/review.md\n",
    );
    expect(await Bun.file(importCountPath).text()).toBe("1");

    await close();
    rmSync(tempRoot, { recursive: true, force: true });
  });
});
