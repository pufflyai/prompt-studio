import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { writeProvisionHarnessExtension } from "../../test-utils/write-provision-harness-extension";
import { provisionProjectWorkspaces } from "../workspaces/provision-coordinator";
import { hashExtensionSource, loadExtensionSource } from "./extension-runtime";
import { createInstalledExtensionRuntime } from "./installed-extension-runtime";
import { syncRepoExtensionsForProjectFolder } from "./repo-extensions";
import { createTestSkillExtensionSource } from "./test-utils/create-test-extension-source";

type AppHandle = Awaited<ReturnType<typeof createTestApp>>;

let handle: AppHandle;
let originalDefaultExtensions: string | undefined;
let originalPstdioHome: string | undefined;
let tempRoot: string;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readWhenEqual = async (path: string, expected: string) => {
  let content = "";
  for (let attempt = 0; attempt < 100; attempt++) {
    content = readFileSync(path, "utf8");
    if (content === expected) return content;
    await delay(20);
  }
  return content;
};

beforeAll(async () => {
  originalDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  originalPstdioHome = process.env.PSTDIO_HOME;
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-runtime-skills-test-"));
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
  handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(tempRoot, "storage") });
});

afterAll(async () => {
  await handle.close();
  if (originalDefaultExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = originalDefaultExtensions;
  if (originalPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = originalPstdioHome;
  rmSync(tempRoot, { recursive: true, force: true });
});

const enableProvisionHarness = async (projectId: string) => {
  const sourcePath = writeProvisionHarnessExtension(tempRoot, {
    installName: "provision-harness",
    localId: "claude-code",
    skillsDir: ".claude/skills",
  });
  const loaded = await loadExtensionSource(sourcePath);
  await handle.deps.extensionService.enableInstalledSourceForProject({
    displayName: loaded.metadata.displayName,
    extensionId: loaded.metadata.id,
    installName: "provision-harness",
    manifest: loaded.manifest,
    name: loaded.metadata.name,
    projectId,
    sourceHash: hashExtensionSource(sourcePath),
    sourcePath,
    version: loaded.metadata.version ?? null,
  });
};

describe("installed extension runtime skills", () => {
  test("refreshes workspace skill copies when a repo extension skill changes on disk", async () => {
    const response = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Edited Skill Project" })),
    });
    const project = (await response.json()) as { id: string };
    const repoPath = (await handle.deps.workspaceService.getDefault(project.id))!.root_path!;
    const sourcePath = createTestSkillExtensionSource({
      displayName: "Lab Skills",
      installName: "lab-skills",
      name: "lab-skills",
      root: join(repoPath, ".pstdio"),
      skillContent: "# Lab Skill\n\nOld steps.\n",
    });
    await enableProvisionHarness(project.id);
    await syncRepoExtensionsForProjectFolder({ ...handle.deps, projectId: project.id });
    await provisionProjectWorkspaces(handle.deps, project.id);
    const skillCopy = join(repoPath, ".claude", "skills", "lab", "SKILL.md");
    expect(readFileSync(skillCopy, "utf8")).toBe("# Lab Skill\n\nOld steps.\n");

    writeFileSync(join(sourcePath, "skills", "lab-skill", "SKILL.md"), "# Lab Skill\n\nNew steps.\n");

    expect(await readWhenEqual(skillCopy, "# Lab Skill\n\nNew steps.\n")).toBe("# Lab Skill\n\nNew steps.\n");
  });

  test("provisions again only when the source content changed", async () => {
    const sourcePath = createTestSkillExtensionSource({
      displayName: "Rewritten Skills",
      installName: "rewritten-skills",
      name: "rewritten-skills",
      root: tempRoot,
    });
    const skillFile = join(sourcePath, "skills", "lab-skill", "SKILL.md");
    let onSourceChanged: (sourcePath: string) => Promise<unknown> = async () => {};
    const provisioned: string[] = [];
    const runtime = createInstalledExtensionRuntime({
      ...handle.deps,
      createRootWatcher: async () => ({ dispose: () => {}, refresh: async () => {} }),
      createSourceWatcher: async (watcherInput) => {
        onSourceChanged = watcherInput.onSourceChanged;
        return { dispose: () => {}, refresh: async () => {} };
      },
      projectRuntimeCatalog: handle.deps.extensionRuntimeCatalog,
      provisionWorkspacesUsingSource: async (changedPath) => {
        provisioned.push(changedPath);
      },
      webviewBuilds: false,
    });
    await runtime.ready;

    try {
      await onSourceChanged(sourcePath);
      writeFileSync(skillFile, readFileSync(skillFile, "utf8"));
      await onSourceChanged(sourcePath);
      expect(provisioned).toEqual([sourcePath]);

      writeFileSync(skillFile, "# Lab Skill\n\nChanged.\n");
      await onSourceChanged(sourcePath);
      expect(provisioned).toEqual([sourcePath, sourcePath]);
    } finally {
      await runtime.dispose();
    }
  });

  test("unchanged attachment keeps prepared workspaces ready while pre-attachment edits reconcile", async () => {
    const response = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Attached Skills" })),
    });
    const project = (await response.json()) as { id: string };
    const sourcePath = createTestSkillExtensionSource({
      displayName: "Attached Skills",
      installName: "attached-skills",
      name: "attached-skills",
      root: tempRoot,
    });
    const loaded = await loadExtensionSource(sourcePath);
    await handle.deps.extensionService.enableInstalledSourceForProject({
      displayName: loaded.metadata.displayName,
      extensionId: loaded.metadata.id,
      installName: "attached-skills",
      manifest: loaded.manifest,
      name: loaded.metadata.name,
      projectId: project.id,
      sourceHash: hashExtensionSource(sourcePath),
      sourcePath,
      version: loaded.metadata.version ?? null,
    });
    let onSourceChanged: (sourcePath: string) => Promise<unknown> = async () => {};
    const provisioned: string[] = [];
    const createRuntime = () =>
      createInstalledExtensionRuntime({
        ...handle.deps,
        createRootWatcher: async () => ({ dispose: () => {}, refresh: async () => {} }),
        createSourceWatcher: async (input) => {
          await input.listInstalledSources();
          onSourceChanged = input.onSourceChanged;
          return { dispose: () => {}, refresh: async () => {} };
        },
        projectRuntimeCatalog: handle.deps.extensionRuntimeCatalog,
        provisionWorkspacesUsingSource: async (path) => {
          provisioned.push(path);
        },
        webviewBuilds: false,
      });
    const runtime = createRuntime();
    await runtime.ready;
    try {
      await onSourceChanged(sourcePath);
      expect(provisioned).toEqual([]);
    } finally {
      await runtime.dispose();
    }

    writeFileSync(join(sourcePath, "skills", "lab-skill", "SKILL.md"), "# Edited before attachment\n");
    const reattached = createRuntime();
    await reattached.ready;
    try {
      await onSourceChanged(sourcePath);
      expect(provisioned).toEqual([sourcePath]);
    } finally {
      await reattached.dispose();
    }
  });

  test("a failed skill reconciliation retries the same source before recording completion", async () => {
    const sourcePath = createTestSkillExtensionSource({
      displayName: "Retried Skills",
      installName: "retried-skills",
      name: "retried-skills",
      root: tempRoot,
    });
    let onSourceChanged: (sourcePath: string) => Promise<unknown> = async () => {};
    let fail = true;
    const provisioned: string[] = [];
    const runtime = createInstalledExtensionRuntime({
      ...handle.deps,
      createRootWatcher: async () => ({ dispose: () => {}, refresh: async () => {} }),
      createSourceWatcher: async (input) => {
        onSourceChanged = input.onSourceChanged;
        return { dispose: () => {}, refresh: async () => {} };
      },
      projectRuntimeCatalog: handle.deps.extensionRuntimeCatalog,
      provisionWorkspacesUsingSource: async (path) => {
        provisioned.push(path);
        if (fail) throw new Error("Skill reconciliation interrupted");
      },
      webviewBuilds: false,
    });
    await runtime.ready;
    try {
      await expect(onSourceChanged(sourcePath)).rejects.toThrow("Skill reconciliation interrupted");
      fail = false;
      await onSourceChanged(sourcePath);
      await onSourceChanged(sourcePath);
      expect(provisioned).toEqual([sourcePath, sourcePath]);
    } finally {
      await runtime.dispose();
    }
  });
});
