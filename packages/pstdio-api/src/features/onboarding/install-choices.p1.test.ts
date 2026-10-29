import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { writeExtension } from "../extensions/default-extensions-test-fixtures";

test("setup enables its selected tool without evaluating unrelated installed code", async () => {
  const root = await mkdtemp(join(tmpdir(), "onboarding-selected-tool-"));
  const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  writeExtension(join(root, "home/extensions/harness-codex"), "harness-codex");
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const gate = Bun.serve({
    port: 0,
    async fetch() {
      entered.resolve();
      await release.promise;
      return new Response("ready");
    },
  });
  const handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  try {
    const created = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Selected tool" })),
    });
    expect(created.status).toBe(201);
    const project = await created.json();
    const unrelated = join(root, "home/extensions/unrelated");
    writeExtension(unrelated, "unrelated");
    await writeFile(
      join(unrelated, "extension.ts"),
      `await fetch(${JSON.stringify(gate.url.href)}); export default {};`,
    );
    const selected = await handle.app.request(`/v1/onboarding?project_id=${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ step: "harnesses", harnesses: ["codex"] }),
    });
    expect(selected.status).toBe(200);
    const job = handle.deps.extensionInstallations.list().find((job) => job.projectId === project.id)!;
    const completed = handle.deps.extensionInstallations.wait(job.id);
    expect(await Promise.race([completed.then(() => "enabled"), entered.promise.then(() => "unrelated")])).toBe(
      "enabled",
    );
    const extensions = await handle.deps.extensionService.listProjectExtensionInstances(project.id);
    expect(
      extensions.find(({ installedSource }) => installedSource.extension_id === "pstdio.harness-codex")?.instance
        .enabled,
    ).toBe(true);
  } finally {
    release.resolve();
    await handle.close();
    gate.stop(true);
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
    await rm(root, { recursive: true, force: true });
  }
});
