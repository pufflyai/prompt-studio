import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AssetReference, ResourceIdentity, StorageRecord, StorageSaveOutcome } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

export const registerGroupedStorageSmokeTests = () => {
  test(
    "packaged public storage saves document edits atomically and survives restarts",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "packaged-grouped-storage-"));
      const source = join(root, "source");
      mkdirSync(source);
      const bundle = await Bun.build({
        entrypoints: [join(import.meta.dir, "fixtures/grouped-storage-extension.ts")],
        target: "bun",
      });
      if (!bundle.success) throw new AggregateError(bundle.logs, "Could not build the public SDK fixture");
      await Bun.write(join(source, "extension.js"), bundle.outputs[0]!);
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "shared-notes",
          publisher: "example",
          version: "1.0.0",
          type: "module",
          main: "extension.js",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      const env = { PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "shared-notes" }]) };
      let host = await startPackagedServe(root, env);
      const post = (path: string, body: unknown) =>
        fetch(`${host.baseUrl}/v1${path}`, {
          method: "POST",
          headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      const command = async <T>(projectId: string, id: string, params: unknown = {}) => {
        const response = await post(
          `/projects/${projectId}/extensions/commands/example.shared-notes.command.${id}/execute`,
          { params },
        );
        expect(response.status).toBe(200);
        const body = (await response.json()) as { outcome: { ok: boolean; value: T } };
        expect(body.outcome).toMatchObject({ ok: true });
        return body.outcome.value;
      };
      const read = (id: string) => command<{ note: StorageRecord; caption: StorageRecord }>(id, "read");
      try {
        const created = await post("/projects", folderProjectInput({ name: "Shared notes" }, root));
        expect(created.status).toBe(201);
        const project = (await created.json()) as { id: string };
        const initial = await read(project.id);
        await command(project.id, "seed-query-records");
        const expectSelected = async () => {
          const selected = await command<{
            page: { records: { fields: { rank: number } }[] };
            next: { records: { fields: { rank: number } }[]; cursor: string | null };
            rows: StorageRecord[];
            count: { count: number };
          }>(project.id, "query-records");
          expect(selected.page.records.map((row) => row.fields.rank)).toEqual([1, 2]);
          expect(selected.next.records.map((row) => row.fields.rank)).toEqual([3]);
          expect(selected.next.cursor).toBeNull();
          expect(selected.rows.map((row) => row.value)).toEqual([
            { state: "ready", rank: 1, body: "full value" },
            { state: "ready", rank: 2, body: "full value" },
          ]);
          expect(selected.count.count).toBe(3);
        };
        await expectSelected();
        const allocated = await command<{ id: string; shorthand: string }>(project.id, "allocate");
        const identity: ResourceIdentity = { ...allocated, kind: "note", aliases: [] };
        expect(await command(project.id, "identity", { id: allocated.id })).toEqual(identity);
        expect(await command(project.id, "find-number", { shorthand: allocated.shorthand })).toEqual([identity]);
        expect(await command(project.id, "number-event")).toMatchObject({
          kind: "event",
          extensionId: "pstdio",
          id: "resource.renumbered",
        });
        const cached = await command<{
          before: StorageRecord;
          reads: { record: StorageRecord; legacy: unknown }[];
        }>(project.id, "check-read-cache");
        expect(cached.before).toEqual(initial.caption);
        expect(cached.reads).toEqual(
          Array.from({ length: 3 }, () => ({
            record: initial.caption,
            legacy: { saved: true },
          })),
        );
        const image = await command<AssetReference>(project.id, "stage", {
          operationId: "image",
          content: "first image",
        });
        const group = {
          operationId: "first-caller",
          edits: [
            {
              recordId: initial.note.recordId,
              expectedRevision: initial.note.revision,
              shared: [{ kind: "text.insert", index: 0, text: "First" }],
              asset: image,
            },
            {
              recordId: initial.caption.recordId,
              expectedRevision: initial.caption.revision,
              replace: "First caption",
            },
          ],
        };
        expect((await command<StorageSaveOutcome>(project.id, "commit", { group })).status).toBe("saved-locally");
        expect((await command<StorageSaveOutcome>(project.id, "commit", { group })).status).toBe("saved-locally");
        const replacement = await command<AssetReference>(project.id, "stage", {
          operationId: "replacement",
          content: "second image",
        });
        const stale = await command<StorageSaveOutcome>(project.id, "commit", {
          group: {
            operationId: "second-caller",
            edits: [
              {
                recordId: initial.note.recordId,
                expectedRevision: initial.note.revision,
                shared: [{ kind: "text.insert", index: 0, text: "Second" }],
                asset: replacement,
              },
              {
                recordId: initial.caption.recordId,
                expectedRevision: initial.caption.revision,
                replace: "Second caption",
              },
            ],
          },
        });
        expect(stale).toMatchObject({ status: "saved-locally", state: "saved-locally" });
        expect((await read(project.id)).caption.value).toBe("Second caption");
        await stopProcess(host.child);
        host = await startPackagedServe(root, env);
        await expectSelected();
        expect((await command<StorageSaveOutcome>(project.id, "outcome", { operationId: "second-caller" })).state).toBe(
          "saved-locally",
        );
        expect(await command(project.id, "identity", { id: allocated.id })).toEqual(identity);
        expect(await command(project.id, "find-number", { shorthand: allocated.shorthand })).toEqual([identity]);
        const final = await read(project.id);
        expect(final.caption.value).toBe("Second caption");
        expect(final.note.asset).toEqual(replacement);
        expect(final.note.shared?.kind).toBe("text");
        await stopProcess(host.child);
        host = await startPackagedServe(root, env);
        expect(await read(project.id)).toEqual(final);
        const later = await command<StorageSaveOutcome>(project.id, "commit", {
          group: {
            operationId: "later-save",
            edits: [{ recordId: final.caption.recordId, replace: "Later caption" }],
          },
        });
        expect(later.state).toBe("saved-locally");
        expect((await read(project.id)).caption.value).toBe("Later caption");
      } finally {
        await stopProcess(host.child);
        rmSync(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
};
