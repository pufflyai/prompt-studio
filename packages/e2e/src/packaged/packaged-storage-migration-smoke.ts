import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerStorageMigrationSmokeTests = () => {
  test("packaged extensions own retryable data versions across concurrent calls and restart", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-storage-migration-"));
    let child: ChildProcess | undefined;
    try {
      let runtime = await startPackagedServe(root);
      child = runtime.child;
      const request = async (path: string, body: unknown) => {
        const response = await fetch(runtime.baseUrl + path, {
          method: "POST",
          headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const value = await response.json();
        expect(response.status, JSON.stringify(value)).toBeLessThan(300);
        return value;
      };
      const folder = join(root, "project");
      mkdirSync(folder);
      const project = await request("/v1/projects", folderProjectInput({ name: "Migrations" }, folder));
      const sourcePath = join(root, "migrations");
      mkdirSync(sourcePath);
      writeFileSync(
        join(sourcePath, "package.json"),
        JSON.stringify({
          name: "migrations",
          publisher: "test",
          version: "1.0.0",
          main: "./extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      writeFileSync(
        join(sourcePath, "extension.ts"),
        `export default { resourceKinds: [{ id: "note", ref: {kind:"resource-kind",id:"note"}, prefix: "NT" }], commands: [{
        id: "import", ref: { kind: "command", id: "import" }, title: "Import",
        params: { version: { type: "number", required: true }, fail: { type: "boolean" } },
        async run(ctx, params) {
          await ctx.storage.migrate(params.version, async (previous, migration) => {
            const id = migration.id("source", "nt");
            await ctx.storage.records.commit({
              operationId: migration.id("import", "op"), edits: [{ recordId: id, replace: { source: "imported" } }]
            });
            await ctx.storage.set("sourceId", id);
            await ctx.storage.set("attempts", (await ctx.storage.get("attempts") ?? 0) + 1);
            if (params.fail) throw new Error("Import interrupted");
            await Bun.sleep(20);
            await ctx.storage.set("previous", previous);
          });
          const position = ctx.storage.positions.between();
          return { id: ctx.storage.ids.create("nt"), allocated: await ctx.resources.allocate({kind: "note", idPrefix: "nt"}),
            positions: [position, ctx.storage.positions.between(position)],
            sourceId: await ctx.storage.get("sourceId"),
            imports: (await ctx.storage.records.list()).filter(record => record.value?.source === "imported").length,
            attempts: await ctx.storage.get("attempts"), previous: await ctx.storage.get("previous"),
            recordAttempts: (await ctx.storage.records.read(ctx.storage.records.id("attempts"))).value,
            legacy: await ctx.storage.readLegacy("missing") ?? null };
        }
      }] };`,
      );
      await request(`/v1/projects/${project.id}/extensions/installed/migrations/enable`, {
        extensionId: "test.migrations",
        name: "migrations",
        displayName: "Migrations",
        sourceKind: "local_path",
        sourcePath,
        manifest: { name: "migrations" },
      });
      const execute = async (params: Record<string, unknown>) => {
        const result = await request(
          `/v1/projects/${project.id}/extensions/commands/test.migrations.command.import/execute`,
          { params },
        );
        if (result.outcome.ok) {
          const { id, positions, sourceId, allocated } = result.outcome.value;
          expect(id).toMatch(/^nt_[0-9A-Za-z]{22}$/);
          expect(sourceId).toMatch(/^nt_[0-9A-Za-z]{22}$/);
          expect(allocated.id).toMatch(/^nt_[0-9A-Za-z]{22}$/);
          expect(allocated.shorthand).toMatch(/^NT-\d+$/);
          expect(positions[0] < positions[1]).toBe(true);
        }
        return result;
      };
      expect(await execute({ version: 1, fail: true })).toMatchObject({ outcome: { ok: false } });
      expect(await execute({ version: 1 })).toMatchObject({
        outcome: { ok: true, value: { attempts: 2, recordAttempts: 2, previous: 0, legacy: null, imports: 1 } },
      });
      const concurrent = await Promise.all([execute({ version: 2 }), execute({ version: 2 })]);
      for (const result of concurrent)
        expect(result).toMatchObject({
          outcome: { ok: true, value: { attempts: 3, recordAttempts: 3, previous: 1, imports: 2 } },
        });
      await stopProcess(child);
      child = undefined;
      runtime = await startPackagedServe(root);
      child = runtime.child;
      const restarted = await execute({ version: 2 });
      expect(restarted.outcome.value.sourceId).toBe(concurrent[0].outcome.value.sourceId);
      expect(restarted).toMatchObject({
        outcome: { ok: true, value: { attempts: 3, recordAttempts: 3, previous: 1, imports: 2 } },
      });
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  });
};
