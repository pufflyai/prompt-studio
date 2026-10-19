import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { createStorageApi } from "./command-environment/storage";
import { executeProjectExtensionCommand } from "./execute-project-extension-command";
import { loadExtensionSource } from "./extension-runtime";
import { createTestExtensionSource } from "./test-utils/create-test-extension-source";

test("known inputs stop dispatch while dynamic reads retain earlier effects and independent commands keep running", async () => {
  const root = await mkdtemp(join(tmpdir(), "local-conflicts-"));
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Conflicts" });
    const source = createTestExtensionSource({
      root,
      name: "unrelated",
      installName: "unrelated",
      displayName: "Unrelated",
    });
    await writeFile(
      join(source, "extension.ts"),
      `
      const command = (id, extra) => ({id, ref: {kind: "command", id}, title: id, ...extra});
      export default {commands: [
        command("known", {
          storageInputs: (_params, records) => [records.id("note")],
          run: async (ctx) => { await ctx.storage.set("known-effect", true); return "ran"; }
        }),
        command("dynamic", {run: async (ctx) => {
          await ctx.storage.set("earlier-effect", true);
          await ctx.storage.get("note");
          await ctx.storage.set("later-effect", true);
        }}),
        command("independent", {run: async (ctx) => ctx.storage.get("independent")}),
        command("inspect", {run: async (ctx) => ctx.storage.records.inspect("branch")})
      ]};`,
    );
    const loaded = await loadExtensionSource(source);
    const enabled = await app.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      sourcePath: source,
      extensionId: loaded.metadata.id,
      installName: "unrelated",
      name: "unrelated",
      displayName: "Unrelated",
      manifest: loaded.manifest,
    });
    const storage = createStorageApi(app.deps, {
      projectId: project.id,
      extensionId: loaded.metadata.id,
      extensionInstanceId: enabled.instance.id,
    });
    await storage.set("independent", true);
    const id = storage.records.id("note");
    const before = await storage.records.read(id);
    await storage.records.commit({
      operationId: "winner",
      edits: [{ recordId: id, expectedRevision: before.revision, replace: "accepted" }],
    });
    await storage.records.commit({
      operationId: "branch",
      edits: [{ recordId: id, expectedRevision: before.revision, replace: "retained" }],
    });
    const execute = (command: string) =>
      executeProjectExtensionCommand(app.deps, {
        projectId: project.id,
        commandId: `test.unrelated.command.${command}`,
        body: { source: "schedule" },
      });
    expect((await execute("known")).outcome.ok).toBe(false);
    expect(await storage.get("known-effect")).toBeUndefined();
    const [dynamic, independent] = await Promise.all([execute("dynamic"), execute("independent")]);
    expect(dynamic.outcome.ok).toBe(false);
    expect(independent.outcome).toMatchObject({ ok: true, value: true });
    expect(await storage.get<boolean>("earlier-effect")).toBe(true);
    expect(await storage.get("later-effect")).toBeUndefined();
    expect((await execute("inspect")).outcome).toMatchObject({ ok: true, value: { conflictId: "branch" } });
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
