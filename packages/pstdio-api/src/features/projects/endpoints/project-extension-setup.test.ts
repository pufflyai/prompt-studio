import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { installDefaultExtensions, syncInstalledExtensionsForProject } from "../../extensions/default-extensions";
import { setupProjectExtensions } from "../project-extension-setup";
import { initializeProjectWorkspace } from "../project-folder";

let root: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let previous: { home?: string; defaults?: string };
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "project-extension-setup-"));
  previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  handle = await createTestApp();
});
afterEach(async () => {
  await handle.close();
  await rm(root, { recursive: true, force: true });
  if (previous.home === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previous.home;
  if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
});

const extension = async (name: string, broken = false) => {
  const source = join(root, name);
  await mkdir(source);
  await writeFile(
    join(source, "package.json"),
    JSON.stringify({
      name,
      publisher: "example",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  await writeFile(
    join(source, "extension.ts"),
    broken ? 'import "./missing-dependency.ts"; export default {};' : "export default {};",
  );
  return { source, installName: name, skipInstall: true };
};

const open = (initial_workspace: { provider_id: string; params: Record<string, unknown> }) =>
  handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initial_workspace }),
  });

test("initial project setup enables defaults discovered before workspace initialization", async () => {
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([await extension("healthy-fixture")]);
  await installDefaultExtensions();
  const folder = join(root, "project");
  await mkdir(folder);
  const project = await handle.deps.projectService.create({ name: "Project" }, async (project) => {
    await syncInstalledExtensionsForProject({
      extensionService: handle.deps.extensionService,
      projectId: project.id,
    });
    const discovered = await handle.deps.extensionService.listProjectExtensionInstances(project.id);
    expect(discovered).toHaveLength(1);
    expect(discovered[0].instance.enabled).toBe(false);

    await initializeProjectWorkspace(
      handle.deps,
      project.id,
      { provider_id: "pstdio.root", params: { path: folder } },
      () => setupProjectExtensions(handle.deps, project.id, true),
    );
  });
  const initialized = await handle.deps.extensionService.listProjectExtensionInstances(project.id);
  expect(initialized[0].instance.enabled).toBe(true);
  expect(await handle.deps.workspaceService.getDefault(project.id)).toMatchObject({
    initializing: false,
    setup_error: null,
    provider_state: "ready",
  });
});

test("retries failed default extension setup without replacing the project or enabling disabled tools", async () => {
  const broken = await extension("broken-fixture", true);
  const healthy = await extension("healthy-fixture");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([broken, healthy]);
  const folder = join(root, "project");
  await mkdir(folder);
  const initial = { provider_id: "pstdio.root", params: { path: folder } };
  const first = await open(initial);
  expect(first.status).toBe(201);
  const project = await first.json();
  expect(project.extension_warnings).toEqual([
    expect.objectContaining({
      code: "extension_setup_failed",
      extension: "broken-fixture",
    }),
  ]);
  const failed = await handle.deps.workspaceService.getDefault(project.id);
  expect(failed?.initializing).toBe(false);
  expect(failed?.setup_error).toContain("missing-dependency");
  const failedRetry = await open(initial);
  expect(failedRetry.status).toBe(200);
  expect(await failedRetry.json()).toMatchObject({
    id: project.id,
    extension_warnings: [
      {
        code: "extension_setup_failed",
        extension: "broken-fixture",
        message: expect.stringContaining("missing-dependency"),
      },
    ],
  });
  expect((await handle.deps.workspaceService.getDefault(project.id))?.setup_error).toContain("missing-dependency");

  const installed = await handle.deps.extensionService.listProjectExtensionInstances(project.id);
  const healthyInstance = installed.find((entry) => entry.installedSource.install_name === "healthy-fixture")!;
  await handle.deps.extensionService.setProjectExtensionEnabled(healthyInstance.instance.id, false);
  const userFile = join(root, "home/extensions/healthy-fixture/user-edit.txt");
  await writeFile(userFile, "preserve");
  await writeFile(join(broken.source, "extension.ts"), "export default {};");

  const retry = await open(initial);
  expect(retry.status).toBe(200);
  expect((await retry.json()).id).toBe(project.id);
  expect(await handle.deps.workspaceService.getDefault(project.id)).toMatchObject({
    id: failed!.id,
    initializing: false,
    setup_error: null,
    provider_state: "ready",
  });
  const recovered = await handle.deps.extensionService.listProjectExtensionInstances(project.id);
  expect(recovered.find((entry) => entry.installedSource.install_name === "broken-fixture")?.instance.enabled).toBe(
    true,
  );
  expect(recovered.find((entry) => entry.instance.id === healthyInstance.instance.id)?.instance.enabled).toBe(false);
  expect(await readFile(userFile, "utf8")).toBe("preserve");

  const reopened = await open(initial);
  expect(reopened.status).toBe(200);
  expect(
    (await handle.deps.extensionService.listProjectExtensionInstances(project.id)).find(
      (entry) => entry.instance.id === healthyInstance.instance.id,
    )?.instance.enabled,
  ).toBe(false);
  expect(await handle.deps.projectService.list()).toHaveLength(1);
});

test("remote project creation retains extension setup failures on its initial workspace", async () => {
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([await extension("broken-fixture", true)]);
  const response = await open({ provider_id: "example.remote", params: {} });
  expect(response.status).toBe(201);
  const project = await response.json();
  expect(project.extension_warnings).toHaveLength(1);
  expect((await handle.deps.workspaceService.getDefault(project.id))?.setup_error).toContain("missing-dependency");
  expect(await handle.deps.projectService.get(project.id)).not.toBeNull();
});
