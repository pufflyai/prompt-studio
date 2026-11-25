import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { createInstalledExtensionSourcesDBService } from "../services/installed-extension-sources/installed-extension-sources";
import { createProjectsDBService } from "../services/projects/projects";
import { createSessionsDBService } from "../services/sessions/sessions";
import { createDb } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { prepareProjectExtensionsUpgrade } from "./project-extensions-upgrade";
import { projects } from "./schemas.pg";

test("project timestamps order by instant and keep ISO strings, nulls and submillisecond precision", async () => {
  const store = await createDb({ path: ":memory:" });
  try {
    await store.db.insert(projects).values([
      {
        id: "earlier",
        name: "Earlier",
        shorthand: "E",
        created_at: "2026-11-22T12:00:00.123456+02:00",
        updated_at: "2026-11-22T10:00:00.000Z",
      },
      {
        id: "later",
        name: "Later",
        shorthand: "L",
        created_at: "2026-11-22T11:00:00.000Z",
        updated_at: "2026-11-22T11:00:00.000Z",
      },
    ]);
    await store.pglite.exec("SET TIME ZONE 'Asia/Kolkata'");
    const service = createProjectsDBService(store.db),
      rows = await service.list();
    expect(rows.map((row) => row.id)).toEqual(["earlier", "later"]);
    expect(rows.map((row) => row.created_at)).toEqual(["2026-11-22T10:00:00.123456Z", "2026-11-22T11:00:00.000Z"]);
    expect(rows[0]!.deleted_at).toBeNull();
    const created = await service.create({ id: "new", name: "New" });
    expect((await service.get(created.id))!.created_at).toBe(created.created_at);
    const updated = await service.update(created.id, { name: "Renamed" });
    expect((await service.get(created.id))!.updated_at).toBe(updated!.updated_at);
    expect(await service.remove(created.id)).toBe(true);
    expect(await service.get(created.id)).toBeNull();
  } finally {
    await store.close();
  }
});

test("released text timestamps migrate to zoned instants and preserve public ISO values after reopen", async () => {
  const root = await mkdtemp(join(tmpdir(), "timestamp-upgrade-"));
  let previous: Awaited<ReturnType<typeof createTextLogOwnerFixture>> | undefined;
  let store: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    previous = await createTextLogOwnerFixture(root);
    await previous.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at,deleted_at) VALUES
      ('kept','Kept','K','2026-11-22T10:00:00.123Z','2026-11-22T10:01:00.000Z',NULL),
      ('deleted','Deleted','D','2026-11-22T12:00:00.123456+02:00','2026-11-22T10:01:00.000Z','2026-11-22T11:00:00.000Z')`);
    const path = previous.path;
    await previous.close();
    previous = undefined;
    store = await createDb({ path });
    const { rows } = await store.pglite.query<{
      table_name: string;
      column_name: string;
    }>(`SELECT table_name,column_name FROM information_schema.columns
      WHERE table_schema='public' AND column_name LIKE '%\\_at' ESCAPE '\\' AND data_type='text'`);
    expect(rows).toEqual([]);
    const service = createProjectsDBService(store.db);
    expect((await service.get("kept"))!.created_at).toBe("2026-11-22T10:00:00.123Z");
    expect((await service.list()).map((row) => row.id)).toEqual(["kept"]);
    await store.close();
    store = await createDb({ path });
    const [deleted] = await store.db.select().from(projects).where(eq(projects.id, "deleted"));
    expect(deleted!.created_at).toBe("2026-11-22T10:00:00.123456Z");
    expect(deleted!.deleted_at).toBe("2026-11-22T11:00:00.000Z");
  } finally {
    await previous?.close();
    await store?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("session activity pages keep ISO values and stable boundaries across timestamp offsets", async () => {
  const store = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(store.db).create({ name: "Activity" });
    const service = createSessionsDBService(store.db);
    const first = await service.create({ project_id: project.id, title: "First", agent: "codex" });
    const second = await service.create({ project_id: project.id, title: "Second", agent: "codex" });
    const { sessions } = await import("./schemas.pg");
    await store.db
      .update(sessions)
      .set({
        created_at: "2026-11-22T09:00:00.000Z",
        updated_at: "2026-11-22T09:00:00.000Z",
        last_request_started: "2026-11-22T12:00:00.123456+02:00",
        last_request_ended: null,
      })
      .where(eq(sessions.id, first.id));
    await store.db
      .update(sessions)
      .set({
        created_at: "2026-11-22T09:00:00.000Z",
        updated_at: "2026-11-22T11:00:00.000Z",
        last_request_started: null,
        last_request_ended: null,
      })
      .where(eq(sessions.id, second.id));
    await store.pglite.exec("SET TIME ZONE 'Asia/Kolkata'");
    const page = await service.query(project.id, { orderBy: "lastActivity", limit: 1 });
    expect(page.rows.map((row) => row.id)).toEqual([second.id]);
    expect(page.rows[0]!.activity_at).toBe("2026-11-22T11:00:00.000Z");
    const next = await service.query(project.id, { orderBy: "lastActivity", limit: 1, cursor: page.nextCursor! });
    expect(next.rows.map((row) => row.id)).toEqual([first.id]);
    expect(next.rows[0]!.activity_at).toBe("2026-11-22T10:00:00.123456Z");
    expect(next.rows[0]!.last_request_started).toBe("2026-11-22T10:00:00.123456Z");
    expect(next.nextCursor).toBeNull();
  } finally {
    await store.close();
  }
});

test("partially restored project extension timestamps replay by instant and still reject changed configuration", async () => {
  const store = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(store.db).create({ name: "Restore" });
    const source = await createInstalledExtensionSourcesDBService(store.db).register({
      install_name: "timestamp",
      extension_id: "example.timestamp",
      display_name: "Timestamp",
      source_kind: "local_path",
      source_path: "/timestamp",
    });
    await store.pglite.exec(
      `CREATE TABLE extension_instances(id text PRIMARY KEY,installed_extension_id text NOT NULL,scope_type text NOT NULL,scope_id text NOT NULL,display_name_override text,enabled boolean NOT NULL DEFAULT true,config_json jsonb NOT NULL DEFAULT '{}',diagnostics_json jsonb,created_at text NOT NULL,updated_at text NOT NULL)`,
    );
    await store.pglite.query(
      `INSERT INTO extension_instances(id,installed_extension_id,scope_type,scope_id,created_at,updated_at) VALUES('legacy',$1,'project',$2,'2026-11-22T12:00:00.1200+02:00','2026-11-22T12:01:00.123456+02:00')`,
      [source.id, project.id],
    );
    const finish = await prepareProjectExtensionsUpgrade(store.db, ":memory:");
    expect(finish).toBeDefined();
    await finish!(true);
    await finish!(true);
    const { project_extensions } = await import("./schemas.pg");
    const rows = await store.db.select().from(project_extensions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.created_at).toBe("2026-11-22T10:00:00.120Z");
    expect(rows[0]!.updated_at).toBe("2026-11-22T10:01:00.123456Z");
    await store.db.update(project_extensions).set({ config_json: { changed: true } });
    await expect(finish!(true)).rejects.toThrow("conflicts with existing configuration");
  } finally {
    await store.close();
  }
});

test("board default upgrade compares offset instants including microseconds", async () => {
  const store = await createDb({ path: ":memory:" });
  try {
    const { setBoardDefault, getBoardDefault } = await import("../services/board-views/board-defaults");
    const { prepareBoardDefaultsUpgrade } = await import("./board-defaults-upgrade");
    const project = await createProjectsDBService(store.db).create({ name: "Board" });
    const scope = { project_id: project.id, extension_id: null, board_id: "native" };
    await setBoardDefault(store.db, scope, "newer", "2026-11-22T10:00:00.123457Z");
    await store.pglite.exec(
      `CREATE TABLE board_default_views(project_id text,extension_instance_id text,board_id text,default_view_id text,updated_at text)`,
    );
    await store.pglite.query(
      `INSERT INTO board_default_views VALUES($1,NULL,'native','restored','2026-11-22T12:00:00.123456+02:00')`,
      [project.id],
    );
    const finish = await prepareBoardDefaultsUpgrade(store.db, ":memory:");
    await finish!(true);
    expect((await getBoardDefault(store.db, scope))!.default_view_id).toBe("newer");
    await setBoardDefault(store.db, scope, "older", "2026-11-22T10:00:00.123455Z");
    await finish!(true);
    expect((await getBoardDefault(store.db, scope))!.default_view_id).toBe("restored");
    expect((await getBoardDefault(store.db, scope))!.updated_at).toBe("2026-11-22T10:00:00.123456Z");
  } finally {
    await store.close();
  }
});

test("timestamps before year 100 retain the original ISO year and microseconds", async () => {
  const store = await createDb({ path: ":memory:" });
  try {
    await store.db.insert(projects).values({
      id: "early",
      name: "Early",
      shorthand: "E",
      created_at: "0001-01-01T00:00:00.123456Z",
      updated_at: "0099-12-31T22:00:00.000Z",
    });
    for (const timezone of ["UTC", "Europe/Paris"]) {
      await store.pglite.exec(`SET TIME ZONE '${timezone}'`);
      const row = await createProjectsDBService(store.db).get("early");
      expect(row!.created_at).toBe("0001-01-01T00:00:00.123456Z");
      expect(row!.updated_at).toBe("0099-12-31T22:00:00.000Z");
    }
  } finally {
    await store.close();
  }
});
