import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
import { observeUpgradeDisk } from "./storage-upgrade-metrics";

const writeFixture = (source: string, indexed: boolean) =>
  Bun.write(
    join(source, "extension.ts"),
    `export default {
    ${indexed ? 'storageIndexes: [{ name: "notes", fields: { title: { path: ["title"], type: "string" } } }],' : ""}
    commands: [{ id: "exercise", ref: { kind: "command", id: "exercise" }, title: "Exercise storage",
      mutating: true, params: { action: { type: "string", required: true } },
      async run(ctx, { action }) {
        const records = ctx.storage.records;
        const note = records.id("note");
        const removed = records.id("removed");
        if (action === "seed") {
          const asset = await ctx.storage.assets.stage({ operationId: "asset", source: new Blob(["retained asset bytes"]) });
          await records.commit({ operationId: "original", edits: [
            { recordId: note, replace: { title: "Original", nested: { body: "first\\nlast", tags: ["one", "two"] } }, asset },
            { recordId: removed, replace: { body: "deleted body\\n".repeat(1000) } }
          ] });
        }
        if (action === "offline") {
          await records.commit({ operationId: "offline-edit", edits: [
            { recordId: note, replace: { title: "Offline", nested: { body: "first\\nlast", tags: ["one", "two", "three"] } } },
            { recordId: removed, deleted: true }
          ] });
        }
        if (action === "restore") await records.commit({ operationId: "restore", edits: [
          { recordId: removed, deleted: false, replace: { title: "Restored" } }
        ] });
        const saved = await records.read(note);
        return { note: saved, removed: await records.read(removed),
          asset: await new Response(await ctx.storage.assets.read(saved.asset)).text(),
          outcome: await records.outcome("offline-edit"),
          selected: action === "indexed" ? await records.query({ index: "notes", limit: 100 }) : null };
      }
    }]
  };`,
  );

export const registerStorageUpgradeSmokeTests = (releasedBinary: () => string) => {
  test(
    "a packaged 0.45 project upgrades nested offline saves, assets, retry identities and deleted records",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "packaged-storage-upgrade-"));
      const source = join(root, "source");
      await mkdir(source);
      await writeFixture(source, false);
      await Bun.write(
        join(source, "package.json"),
        JSON.stringify({
          name: "storage-upgrade",
          publisher: "example",
          version: "1.0.0",
          main: "extension.ts",
          engines: { pstdio: "^0.2.1" },
        }),
      );
      const env = { PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "storage-upgrade" }]) };
      let host = await startPackagedServe(root, env, releasedBinary());
      const post = async (path: string, body: unknown) => {
        const response = await fetch(host.baseUrl + path, {
          method: "POST",
          headers: { authorization: `Bearer ${host.descriptor.token}`, "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const value = await response.json();
        expect(response.status, JSON.stringify(value)).toBeLessThan(300);
        return value;
      };
      let disk: ReturnType<typeof observeUpgradeDisk> | undefined;
      try {
        const project = await post("/v1/projects", folderProjectInput({ name: "Storage upgrade" }, root));
        const exercise = async (action: string) => {
          const result = await post(
            `/v1/projects/${project.id}/extensions/commands/example.storage-upgrade.command.exercise/execute`,
            { params: { action } },
          );
          expect(result.outcome).toMatchObject({ ok: true });
          return result.outcome.value;
        };
        await exercise("seed");
        const before = await exercise("offline");
        expect(before.note.value.title).toBe("Offline");
        expect(before.removed).toMatchObject({ deleted: true, value: null });
        expect(before.asset).toBe("retained asset bytes");
        await stopProcess(host.child);
        const upgradedSource = join(root, "upgraded-source");
        await mkdir(upgradedSource);
        await writeFixture(upgradedSource, true);
        await Bun.write(
          join(upgradedSource, "package.json"),
          JSON.stringify({
            name: "storage-upgrade",
            publisher: "example",
            version: "1.1.0",
            main: "extension.ts",
            engines: { pstdio: "^0.2.1" },
          }),
        );
        env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
        disk = observeUpgradeDisk(root);
        await disk.sample();
        const upgradeStarted = performance.now();
        host = await startPackagedServe(root, env);
        const upload = new FormData();
        upload.set("kind", "upload");
        upload.set("installName", "storage-upgrade");
        upload.set("folderName", "storage-upgrade");
        upload.set("force", "true");
        for (const path of ["package.json", "extension.ts"]) {
          upload.append("files", new File([await Bun.file(join(upgradedSource, path)).text()], path));
        }
        const installed = await fetch(`${host.baseUrl}/v1/projects/${project.id}/extensions/install`, {
          method: "POST",
          headers: { authorization: `Bearer ${host.descriptor.token}` },
          body: upload,
        });
        expect(installed.status, await installed.text()).toBe(201);
        const after = await exercise("indexed");
        const upgradeMs = performance.now() - upgradeStarted;
        expect(after.note).toEqual(before.note);
        expect(after.removed).toEqual(before.removed);
        expect(after.outcome).toEqual(before.outcome);
        expect(after.asset).toBe(before.asset);
        expect(after.selected.records).toHaveLength(1);
        expect(after.selected.records[0].fields.title).toBe("Offline");
        const retry = await exercise("seed");
        expect(retry.note).toEqual(before.note);
        expect(retry.removed).toEqual(before.removed);
        const restored = await exercise("restore");
        expect(restored.removed.value).toEqual({ title: "Restored" });
        await stopProcess(host.child);
        const restartStarted = performance.now();
        host = await startPackagedServe(root, env);
        expect((await exercise("indexed")).removed).toEqual(restored.removed);
        const restartMs = performance.now() - restartStarted;
        console.log(
          JSON.stringify({
            fixture: "released-0.45-functional-upgrade",
            upgradeMs,
            restartMs,
            disk: await disk.stop(),
          }),
        );
        disk = undefined;
      } finally {
        try {
          await disk?.stop();
        } finally {
          await stopProcess(host.child);
          await rm(root, { recursive: true, force: true });
        }
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
};
