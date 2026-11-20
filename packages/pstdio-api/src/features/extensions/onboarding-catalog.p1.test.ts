import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { setupProjectExtensions } from "../projects/project-extension-setup";
import { writeExtension } from "./default-extensions-test-fixtures";
import { packagedExtensionCatalog } from "./extension-catalog";

test.each([
  "absent",
  "renamed",
])("Coding onboarding completes through host installation with an installed browser and a %s catalog name", async (catalogName) => {
  const root = await mkdtemp(join(tmpdir(), "onboarding-uncatalogued-browser-"));
  const previous = new Map(
    ["PSTDIO_HOME", "PSTDIO_DEFAULT_EXTENSIONS", "PSTDIO_EXTENSION_CATALOG"].map((name) => [name, process.env[name]]),
  );
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_EXTENSION_CATALOG = join(root, "catalog.json");
  await writeFile(
    process.env.PSTDIO_EXTENSION_CATALOG,
    JSON.stringify({
      version: 1,
      extensions: packagedExtensionCatalog.extensions.flatMap((entry) => {
        if (entry.installName !== "pstdio-skill-browser") return [entry];
        return catalogName === "renamed" ? [{ ...entry, installName: "optional-browser" }] : [];
      }),
    }),
  );
  const names = ["workspaces", "pstdio-terminal", "planner", "reports", "artifacts", "base-themes", "skills"];
  for (const name of [...names, "pstdio-skill-browser"]) writeExtension(join(root, "home/extensions", name), name);
  const handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  try {
    const { app, deps } = handle;
    const project = await deps.projectService.create({ name: "Coding" });
    const folder = join(root, "project");
    await mkdir(folder);
    await deps.workspaceService.ensureDefault({ project_id: project.id, root_path: folder, name: "Project folder" });
    await setupProjectExtensions(deps, project.id, false);
    const browser = (await deps.extensionService.listProjectExtensionInstances(project.id)).find(
      ({ installedSource }) => installedSource.extension_id === "pstdio.pstdio-skill-browser",
    )!;
    await deps.extensionService.setProjectExtensionEnabled(browser.instance.id, true);
    await deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "onboarding",
      extensionId: "pstdio.onboarding",
      name: "onboarding",
      displayName: "Onboarding",
      sourcePath: join(import.meta.dir, "../../../../../extensions/pstdio-onboarding"),
      manifest: {},
    });
    const execute = async (command: string, params = {}) => {
      const response = await app.request(
        `/v1/projects/${project.id}/extensions/commands/pstdio.onboarding.command.${command}/execute`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ params }) },
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.outcome.ok, JSON.stringify(body.outcome)).toBe(true);
      return body.outcome.value;
    };
    expect(await execute("update", { request: { step: "complete", workAreas: ["coding"] } })).toMatchObject({
      completed: true,
      workAreas: ["coding"],
    });
    const jobs = deps.extensionInstallations.list().filter((job) => job.projectId === project.id);
    const expected = catalogName === "renamed" ? [...names, "optional-browser"] : names;
    expect(jobs.map((job) => job.installName).sort()).toEqual([...expected].sort());
    await Promise.all(jobs.map((job) => deps.extensionInstallations.wait(job.id)));
    expect(await execute("preferences")).toMatchObject({ completed: true, workAreas: ["coding"] });
  } finally {
    await handle.close();
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});
