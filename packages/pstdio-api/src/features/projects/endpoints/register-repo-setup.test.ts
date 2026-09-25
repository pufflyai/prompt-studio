import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
let previousDefaults: string | undefined;

beforeAll(async () => {
  root = await realpath(mkdtempSync(join(tmpdir(), "register-repo-setup-")));
  previousDefaults = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify({ defaultExtensions: [] });
  handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage"), buildWebviews: false });
});

afterAll(async () => {
  await handle.close();
  if (previousDefaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaults;
  rmSync(root, { recursive: true, force: true });
});

const register = (projectId: string, path: string) =>
  handle.app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "repo", path }),
  });

test.each([false, true])("overlapping registrations preserve the config owner (path alias: %s)", async (alias) => {
  const first = await handle.deps.projectService.create({ name: "First owner" });
  const second = await handle.deps.projectService.create({ name: "Second owner" });
  const path = join(root, `overlapping-${alias}`);
  mkdirSync(path);
  const responses = await Promise.all([register(first.id, path), register(second.id, alias ? `${path}/.` : path)]);
  expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  const winner = responses[0].status === 201 ? first : second;
  const loser = winner === first ? second : first;
  expect(JSON.parse(readFileSync(join(path, ".pstdio", "config.json"), "utf8")).project_id).toBe(winner.id);
  expect(await handle.deps.repoService.listByProject(winner.id)).toHaveLength(1);
  expect(await handle.deps.repoService.listByProject(loser.id)).toEqual([]);
  expect(await handle.deps.workspaceService.getDefault(loser.id)).toBeNull();
});

test("workspace setup failure rolls back extension sources, instances, and events", async () => {
  const project = await handle.deps.projectService.create({ name: "Workspace conflict" });
  const existingWorkspace = await handle.deps.workspaceService.create({
    project_id: project.id,
    shorthand_base: "existing",
    name: "repo",
  });
  const path = join(root, "workspace-conflict");
  const sourcePath = join(path, ".pstdio", "extensions", "example");
  mkdirSync(sourcePath, { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "repo-setup-example",
      version: "1.0.0",
      displayName: "Example",
      publisher: "test",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
      type: "module",
    }),
  );
  writeFileSync(join(sourcePath, "extension.ts"), "export default {};\n");
  const seq = handle.deps.eventBus.seq;
  const response = await register(project.id, path);
  expect(response.status).toBe(500);
  expect(await handle.deps.repoService.listByProject(project.id)).toEqual([]);
  expect(await handle.deps.workspaceService.list(project.id)).toEqual([existingWorkspace]);
  expect(await handle.deps.extensionService.listProjectExtensionInstances(project.id)).toEqual([]);
  expect(await handle.deps.installedExtensionSourcesService.getBySourcePath(sourcePath)).toBeNull();
  expect(handle.deps.eventBus.getSince(seq)).toEqual([]);
});

test("failed setup releases the config claim so another project can retry", async () => {
  const first = await handle.deps.projectService.create({ name: "Failed owner" });
  const second = await handle.deps.projectService.create({ name: "Retry owner" });
  await handle.deps.workspaceService.create({ project_id: first.id, shorthand_base: "existing", name: "repo" });
  const path = join(root, "claim-retry");
  mkdirSync(path);
  expect((await register(first.id, path)).status).toBe(500);
  expect((await register(second.id, path)).status).toBe(201);
  expect(JSON.parse(readFileSync(join(path, ".pstdio", "config.json"), "utf8")).project_id).toBe(second.id);
});

test("failed relinking restores the previous config bytes", async () => {
  const project = await handle.deps.projectService.create({ name: "Failed relink" });
  await handle.deps.workspaceService.create({ project_id: project.id, shorthand_base: "existing", name: "repo" });
  const path = join(root, "restore-config");
  mkdirSync(join(path, ".pstdio"), { recursive: true });
  const configPath = join(path, ".pstdio", "config.json");
  const previous = '{ "project_id": "deleted-project", "custom": true }\n';
  writeFileSync(configPath, previous);
  expect((await register(project.id, path)).status).toBe(500);
  expect(readFileSync(configPath, "utf8")).toBe(previous);
});

test("failed setup preserves existing extension registrations and settings", async () => {
  const project = await handle.deps.projectService.create({ name: "Existing extension" });
  await handle.deps.workspaceService.create({ project_id: project.id, shorthand_base: "existing", name: "repo" });
  const path = join(root, "existing-extension");
  const sourcePath = join(path, ".pstdio", "extensions", "existing");
  mkdirSync(sourcePath, { recursive: true });
  const manifest = {
    name: "existing-setup-example",
    version: "1.0.0",
    displayName: "Changed on disk",
    publisher: "test",
    main: "./extension.ts",
    engines: { pstdio: EXTENSION_API_VERSION },
    type: "module",
  };
  writeFileSync(join(sourcePath, "package.json"), JSON.stringify(manifest));
  writeFileSync(join(sourcePath, "extension.ts"), "export default {};\n");
  await handle.deps.extensionService.syncInstalledSourceForProject({
    displayName: "Existing name",
    extensionId: "test.existing-setup-example",
    installName: "existing",
    manifest,
    name: manifest.name,
    projectId: project.id,
    sourcePath,
    sourceKind: "local_path",
    version: "1.0.0",
  });
  const existing = await handle.deps.extensionService.listProjectExtensionInstances(project.id);
  const seq = handle.deps.eventBus.seq;
  expect((await register(project.id, path)).status).toBe(500);
  expect(await handle.deps.extensionService.listProjectExtensionInstances(project.id)).toEqual(existing);
  expect(await handle.deps.installedExtensionSourcesService.getBySourcePath(sourcePath)).toEqual(
    existing[0].installedSource,
  );
  expect(handle.deps.eventBus.getSince(seq)).toEqual([]);
});
