import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { LogDelivery } from "pstdio-sync/logs";
import { encodeLogValue } from "../services/extension-storage/ordered-log-sql";
import { createOrderedLogStore } from "../services/extension-storage/ordered-log-store";
import { createDb } from "./connection.pglite";
import { prepareLogOwnerUpgrade } from "./log-owner-upgrade";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";

for (const interruption of ["normal", "schema", "restore"])
  test(`integer log ownership preserves bytes and retries after ${interruption} upgrade`, async () => {
    const root = await mkdtemp(join(tmpdir(), "log-owner-upgrade-"));
    const previous = await createTextLogOwnerFixture(root);
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    let previousClosed = false;
    try {
      await previous.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
        VALUES ('project-a','A','A','2026-11-20T12:00:00.000Z','2026-11-20T12:00:00.000Z'),
        ('project-b','B','B','2026-11-20T12:00:00.000Z','2026-11-20T12:00:00.000Z')`);
      const payload = {
        id: "pending",
        writerId: "device-a",
        createdAt: "2026-11-20T12:00:00.000Z",
        value: { text: "日本語 😀\u0000" },
      };
      const delivery: LogDelivery = {
        envelope: { updateId: "retry-identity-unchanged", payload: "AAEC/w==", blobIds: ["retained-leaf-identity"] },
        blobs: [{ blobId: "retained-leaf-identity", bytes: "AP8=", children: [] }],
      };
      for (const project of ["project-a", "project-b"]) {
        await previous.pglite.query(
          `INSERT INTO storage_log_streams
          (workbench_id,extension_id,log_name,scope,stream,head,complete_through,state_id,through)
          VALUES ($1,'example.logs','activity','project','device-a',71,67,'saved-root',65)`,
          [project],
        );
        await previous.pglite.query(
          `INSERT INTO storage_log_entries
          (workbench_id,extension_id,log_name,scope,stream,entry_id,writer_id,created_at,fingerprint,entry,local_sequence,local,envelope)
          VALUES ($1,'example.logs','activity','project','device-a','pending','device-a',1795176000000,'saved-fingerprint',$2,401,true,$3)`,
          [project, encodeLogValue(payload), encodeLogValue(delivery)],
        );
      }
      const originalEntries = (
        await previous.pglite.query<
          Record<string, unknown> & {
            workbench_id: string;
            local_sequence: number;
            entry_hex: string;
            envelope_hex: string;
            entry: Uint8Array;
            envelope: Uint8Array;
          }
        >(`SELECT *, encode(entry,'hex') AS entry_hex,
        encode(envelope,'hex') AS envelope_hex FROM storage_log_entries ORDER BY workbench_id`)
      ).rows;
      if (interruption !== "normal") {
        const finish = await prepareLogOwnerUpgrade(previous.db, previous.path);
        await migrate(previous.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle-0.46") });
        if (interruption === "restore") {
          await previous.pglite.exec(`CREATE FUNCTION stop_log_restore() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF (SELECT project_id FROM owners JOIN log_streams ON owners.id=log_streams.owner_id
              WHERE log_streams.id=NEW.stream_id)='project-b' THEN RAISE EXCEPTION 'stop restoration';
            END IF; RETURN NEW; END $$;
            CREATE TRIGGER stop_log_restore BEFORE INSERT ON log_entries FOR EACH ROW EXECUTE FUNCTION stop_log_restore()`);
          await expect(finish!()).rejects.toThrow("Failed query");
          expect(await Bun.file(`${previous.path}-log-stream-owners-upgrade.jsonl`).exists()).toBe(true);
          expect(await Bun.file(`${previous.path}-log-entry-streams-upgrade.jsonl`).exists()).toBe(true);
          await previous.pglite.exec("DROP TRIGGER stop_log_restore ON log_entries");
        }
      }
      await previous.close();
      previousClosed = true;
      store = await createDb({ path: previous.path });
      const address = {
        owner: { workbenchId: "project-a", extensionId: "example.logs" },
        name: "activity",
        scope: "project",
        stream: "device-a",
        writerId: "device-a",
      };
      const logs = createOrderedLogStore(store.db, address);
      expect(await logs.status()).toEqual({ head: 71, completeThrough: 67, stateId: "saved-root", through: 65 });
      expect(await logs.pending(10)).toEqual([{ entry: payload, delivery }]);
      // A replay must return the original encrypted delivery, even if a new delivery is proposed.
      expect(
        await logs.prepare("pending", {
          envelope: { ...delivery.envelope, updateId: "replacement-envelope" },
          blobs: [],
        }),
      ).toEqual(delivery);
      const migrated = (
        await store.pglite.query(`SELECT owners.project_id, log_entries.local_sequence,
        encode(entry,'hex') AS entry_hex, encode(envelope,'hex') AS envelope_hex
        FROM log_entries JOIN log_streams ON log_entries.stream_id=log_streams.id
        JOIN owners ON log_streams.owner_id=owners.id ORDER BY owners.project_id`)
      ).rows;
      expect(migrated).toEqual(
        originalEntries.map((row) => ({
          project_id: row.workbench_id,
          local_sequence: row.local_sequence,
          entry_hex: row.entry_hex,
          envelope_hex: row.envelope_hex,
        })),
      );
      const archived = (await readFile(`${previous.path}-migration-exports/log-entries.jsonl`, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(archived.map((row) => ({ ...row, entry: row.entry.slice(2), envelope: row.envelope.slice(2) }))).toEqual(
        originalEntries.map(({ entry, envelope, entry_hex, envelope_hex, ...row }) => ({
          ...row,
          entry: entry_hex,
          envelope: envelope_hex,
        })),
      );
      await logs.append({ after: "upgrade" }, { id: "new-append" });
      expect(await logs.pendingThrough()).toBeGreaterThan(401);
      await store.close();
      store = await createDb({ path: previous.path });
      expect(await createOrderedLogStore(store.db, address).pending(10)).toHaveLength(2);
      expect(await Bun.file(`${previous.path}-log-entry-streams-upgrade.jsonl`).exists()).toBe(false);
    } finally {
      if (!previousClosed) await previous.close();
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
