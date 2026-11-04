import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { prepareDefaultProjectExtensions, setupProjectExtensions } from "../projects/project-extension-setup";
import { writeExtension } from "./default-extensions-test-fixtures";
import { createProjectExtensionLifecycle } from "./project-extension-lifecycle";

test("a disabled default stays disabled after a restart and another project", async () => {
  const root = mkdtempSync(join(tmpdir(), "default-extension-choice-"));
  const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  const source = join(root, "source");
  const home = join(root, "home");
  const target = join(home, "extensions", "example-default");
  writeExtension(source, "example-default");
  process.env.PSTDIO_HOME = home;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([
    { source, installName: "example-default", skipInstall: true },
  ]);
  let handle: Awaited<ReturnType<typeof createTestApp>> | undefined;
  try {
    handle = await createTestApp({ databasePath: join(root, "database"), storageRoot: join(root, "storage") });
    let deps = handle.deps;
    let lifecycle = createProjectExtensionLifecycle(deps);
    expect(await prepareDefaultProjectExtensions(deps)).toEqual([]);
    const project = await deps.projectService.create({ name: "First project" });
    await deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project folder", root_path: root });
    await setupProjectExtensions(deps, project.id, false);
    const first = (await deps.extensionService.listProjectExtensionInstances(project.id)).find(
      ({ installedSource }) => installedSource.install_name === "example-default",
    )!;
    expect(first.instance.enabled).toBe(true);
    await lifecycle.setEnabled(project.id, first.instance.id, false);
    await handle.close();
    handle = await createTestApp({ databasePath: join(root, "database"), storageRoot: join(root, "storage") });
    deps = handle.deps;
    lifecycle = createProjectExtensionLifecycle(deps);
    // A normal restart and the next project's preparation keep the first project's choice.
    expect(await prepareDefaultProjectExtensions(deps)).toEqual([]);
    const peer = await deps.projectService.create({ name: "Next project" });
    await setupProjectExtensions(deps, peer.id, false);
    const adopted = (await deps.extensionService.listProjectExtensionInstances(peer.id)).find(
      ({ installedSource }) => installedSource.install_name === "example-default",
    );
    expect(adopted?.instance.enabled).toBe(true);
    const retained = await deps.extensionService.getProjectExtensionInstance(project.id, first.instance.id);
    expect(retained?.instance.enabled).toBe(false);
    await lifecycle.setEnabled(peer.id, adopted!.instance.id, false);
    // Explicit installation affects only this project; another disabled instance stays disabled.
    const reinstalled = await lifecycle.install(project.id, {
      installName: "example-default",
      skipInstall: true,
      force: true,
      source: { kind: "project-folder", path: "source" },
    });
    expect(reinstalled.extension.enabled).toBe(true);
    expect(existsSync(target)).toBe(true);
    expect(
      (await deps.extensionService.getProjectExtensionInstance(peer.id, adopted!.instance.id))?.instance.enabled,
    ).toBe(false);
    const later = await deps.projectService.create({ name: "After explicit install" });
    await setupProjectExtensions(deps, later.id, false);
    expect(
      (await deps.extensionService.listProjectExtensionInstances(later.id)).find(
        ({ installedSource }) => installedSource.install_name === "example-default",
      )?.instance.enabled,
    ).toBe(true);
  } finally {
    await handle?.close();
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
    rmSync(root, { recursive: true, force: true });
  }
});
