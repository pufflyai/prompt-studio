import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createDb, createFilesDBService, createProjectsDBService, createSessionsDBService } from "pstdio-db";
import { createFilesStorageService } from "pstdio-storage";
import { EventBus } from "../features/sync/event-bus";
import { createFileService } from "./file-service";
import { createSessionService } from "./session-service";

test("a failed database commit restores the checkpoint bytes and emits no removal", async () => {
  const root = mkdtempSync(join(tmpdir(), "session-removal-rollback-"));
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const bus = new EventBus();
    const raw = createSessionsDBService(db);
    const service = createSessionService({ sessionsDb: raw, eventBus: bus });
    const files = createFileService({
      filesDBService: createFilesDBService(db),
      filesStorageService: createFilesStorageService(root),
      eventBus: bus,
    });
    const project = await createProjectsDBService(db).create({ name: "Rollback" });
    const session = await raw.create({
      project_id: project.id,
      title: "Keep history",
      agent: "test",
      status: "completed",
    });
    const file = await files.upload({
      project_id: project.id,
      file_name: "history.json",
      file_kind: "session_messages",
      data: Buffer.from("[]"),
    });
    await raw.update(session.id, { session_file_id: file.id });
    await db.execute(
      sql`CREATE FUNCTION reject_session_removal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Commit rejected'; END $$`,
    );
    await db.execute(
      sql`CREATE CONSTRAINT TRIGGER reject_session_removal AFTER DELETE ON sessions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_session_removal()`,
    );
    const removals: unknown[] = [];
    bus.subscribe((event) => removals.push(event));
    await expect(service.remove(session.id, files)).rejects.toThrow("Commit rejected");
    expect((await raw.get(session.id))?.session_file_id).toBe(file.id);
    expect(await files.get(file.id)).not.toBeNull();
    expect(readFileSync(file.storage_path, "utf8")).toBe("[]");
    expect(removals).toEqual([]);
  } finally {
    await close();
    rmSync(root, { recursive: true, force: true });
  }
});
