import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAcceptedRevision } from "pstdio-extensions";
import { createTestApp } from "../../test-utils/create-test-app";
import { writeExtension } from "./default-extensions-test-fixtures";

test("project setup adopts the frontend output its repo default already validated", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "repo-default-prepared-")));
  const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  const home = join(root, "home");
  const repo = join(root, "project");
  const source = join(root, "source");
  mkdirSync(repo);
  writeExtension(source, "prepared-repo", "repo");
  writeFileSync(
    join(source, "extension.ts"),
    `export default { views: [{ id: "page", ref: { kind: "view", id: "page" }, title: "Prepared repo", body: { kind: "webview", entry: { kind: "package-asset", path: "./view.ts", baseUrl: import.meta.url } } }] };`,
  );
  writeFileSync(join(source, "view.ts"), 'document.body.textContent = "Prepared repo view";');
  process.env.PSTDIO_HOME = home;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([{ source, installName: "prepared-repo", skipInstall: true }]);
  let app: Awaited<ReturnType<typeof createTestApp>> | undefined;
  try {
    // A later build manager must not conceal losing an already-validated install output.
    app = await createTestApp({ buildWebviews: false });
    const response = await app.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Prepared repo",
        initial_workspace: { provider_id: "pstdio.root", params: { path: repo } },
      }),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    expect((await app.deps.workspaceService.getDefault(project.id))?.setup_error).toBeNull();
    const artifacts = join(home, "cache", "prepared-webviews");
    const outputs = readdirSync(artifacts)
      .map((id) => ({ id, module: join(artifacts, id, "dist", "module.js") }))
      .filter((output) => existsSync(output.module));
    expect(outputs).toHaveLength(1);
    expect(readFileSync(outputs[0]!.module, "utf8")).toContain("Prepared repo view");
    const target = join(repo, ".pstdio", "extensions", "prepared-repo");
    const accepted = await readAcceptedRevision(target);
    expect(accepted).not.toBeNull();
    expect(accepted?.webviews?.["pstdio.prepared-repo.view.page"]?.id).toBe(outputs[0]!.id);
    const sources = await app.deps.extensionService.listProjectExtensionInstances(project.id);
    expect(sources).toContainEqual(
      expect.objectContaining({
        installedSource: expect.objectContaining({ source_path: target }),
        instance: expect.objectContaining({ enabled: true }),
      }),
    );
  } finally {
    await app?.close();
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
    rmSync(root, { recursive: true, force: true });
  }
});
