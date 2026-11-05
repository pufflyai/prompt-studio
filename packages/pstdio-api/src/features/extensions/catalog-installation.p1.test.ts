import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { setupProjectExtensions } from "../projects/project-extension-setup";
import { writeExtension } from "./default-extensions-test-fixtures";

test.each([
  true,
  false,
])("public catalog selection provisions an aliased installed tool with explicit identity=%s", async (explicitIdentity) => {
  const root = await mkdtemp(join(tmpdir(), "catalog-selection-"));
  const previous = {
    home: process.env.PSTDIO_HOME,
    defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS,
    catalog: process.env.PSTDIO_EXTENSION_CATALOG,
  };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_EXTENSION_CATALOG = join(root, "catalog.json");
  const tool = join(root, "home/extensions/tool-alias");
  writeExtension(tool, "tool");
  await writeFile(
    join(tool, "extension.ts"),
    `export default { hooks: [{ id: "provision", ref: { kind: "hook", id: "provision" }, event: { extensionId: "pstdio", kind: "event", id: "workspace.provision" }, async run(ctx) { await ctx.workspaceFiles.writeText("selected-tool.txt", ctx.project.id); } }] };`,
  );
  await writeFile(
    process.env.PSTDIO_EXTENSION_CATALOG,
    JSON.stringify({
      version: 1,
      extensions: [
        {
          installName: "tool",
          ...(explicitIdentity ? { extensionId: "pstdio.tool" } : {}),
          displayName: "Tool",
          description: "Tool",
          default: false,
          origin: { kind: "git", url: "https://example.com/repo.git", path: "extensions/tool", ref: "main" },
        },
      ],
    }),
  );
  const caller = join(root, "caller");
  writeExtension(caller, "caller");
  await writeFile(
    join(caller, "extension.ts"),
    `export default { commands: [{ id: "select", ref: { kind: "command", id: "select" }, title: "Select tool", async run(ctx) { await ctx.extensions.install(["tool"]); return ctx.extensions.list(); } }] };`,
  );
  const handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  try {
    const { app, deps } = handle;
    const project = await deps.projectService.create({ name: "Selected" });
    const peer = await deps.projectService.create({ name: "Other" });
    for (const current of [project, peer]) {
      const path = join(root, current.id);
      await mkdir(path);
      await deps.workspaceService.ensureDefault({ project_id: current.id, root_path: path, name: "Project folder" });
      await setupProjectExtensions(deps, current.id, false);
    }
    await deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "caller",
      extensionId: "pstdio.caller",
      name: "caller",
      displayName: "Caller",
      sourcePath: caller,
      manifest: {},
    });
    const selected = await app.request(
      `/v1/projects/${project.id}/extensions/commands/pstdio.caller.command.select/execute`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ params: {} }) },
    );
    expect(selected.status).toBe(200);
    const response = await selected.json();
    expect(response.outcome.ok).toBe(true);
    const job = deps.extensionInstallations
      .list()
      .find((job) => job.installName === "tool" && job.projectId === project.id)!;
    await deps.extensionInstallations.wait(job.id);
    expect(await readFile(join(root, project.id, "selected-tool.txt"), "utf8")).toBe(project.id);
    expect(await Bun.file(join(root, peer.id, "selected-tool.txt")).exists()).toBe(false);
    expect(
      (await deps.extensionService.listProjectExtensionInstances(peer.id)).find(
        ({ installedSource }) => installedSource.extension_id === "pstdio.tool",
      )?.instance.enabled,
    ).toBe(false);
  } finally {
    await handle.close();
    for (const [name, value] of [
      ["PSTDIO_HOME", previous.home],
      ["PSTDIO_DEFAULT_EXTENSIONS", previous.defaults],
      ["PSTDIO_EXTENSION_CATALOG", previous.catalog],
    ]) {
      if (value === undefined) delete process.env[name!];
      else process.env[name!] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});
