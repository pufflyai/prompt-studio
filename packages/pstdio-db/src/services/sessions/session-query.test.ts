import { afterEach, beforeEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "../../db/connection.pglite";
import { sessions, workspace_sessions } from "../../db/schemas.pg";
import { createProjectsDBService } from "../projects/projects";
import { createWorkspacesDBService } from "../workspaces/workspaces";
import { createSessionsDBService } from "./sessions";

let conn: Awaited<ReturnType<typeof createDb>>;
let service: ReturnType<typeof createSessionsDBService>;
let projectId: string;
beforeEach(async () => {
  conn = await createDb({ path: ":memory:" });
  service = createSessionsDBService(conn.db);
  projectId = (await createProjectsDBService(conn.db).create({ name: "query" })).id;
});
afterEach(async () => {
  await conn.close();
});

const create = async (title: string, agent = "claude-code", date = "2026-10-01T00:00:00.000Z") => {
  const row = await service.create({ project_id: projectId, title, agent });
  await conn.db.update(sessions).set({ created_at: date, updated_at: date }).where(eq(sessions.id, row.id));
  return row;
};

test("pages newest first without duplicates when timestamps tie and new sessions arrive", async () => {
  const rows = await Promise.all([create("a"), create("b"), create("c")]);
  const expected = rows
    .map((row) => row.id)
    .sort()
    .reverse();
  const first = await service.query(projectId, { limit: 2 });
  expect(first.rows.map((row) => row.id)).toEqual(expected.slice(0, 2));
  await create("new", "codex", "2026-10-02T00:00:00.000Z");
  const second = await service.query(projectId, { limit: 2, cursor: first.nextCursor! });
  expect(second.rows.map((row) => row.id)).toEqual(expected.slice(2));
  expect(second.nextCursor).toBeNull();
  expect((await service.query(projectId, { cursor: "invalid", limit: 0 })).rows).toHaveLength(1);
  const other = (await createProjectsDBService(conn.db).create({ name: "other" })).id;
  const foreign = await service.create({ project_id: other, title: "foreign", agent: "codex" });
  expect((await service.query(other, { cursor: first.nextCursor! })).rows.map((row) => row.id)).toEqual([foreign.id]);
  expect((await service.query(projectId)).rows.map((row) => row.id)).not.toContain(foreign.id);
});

test("combines status, harness, anchor and inclusive time filters within one project", async () => {
  const wanted = await create("wanted");
  await service.addAnchors(wanted.id, [{ type: "ticket", id: "T" }]);
  await create("other harness", "codex");
  await create("old", "claude-code", "2026-09-30T00:00:00.000Z");
  const archived = await create("archived");
  await service.archive(archived.id);
  const other = (await createProjectsDBService(conn.db).create({ name: "other" })).id;
  await service.create({ project_id: other, title: "foreign", agent: "claude-code" });
  const page = await service.query(projectId, {
    status: ["in_progress", "awaiting_input"],
    agent: "claude-code",
    anchor: { type: "ticket", id: "T" },
    createdFrom: "2026-10-01T00:00:00.000Z",
    createdTo: "2026-10-01T00:00:00.000Z",
    updatedFrom: "2026-10-01T00:00:00.000Z",
  });
  expect(page.rows.map((row) => row.id)).toEqual([wanted.id]);
  expect(page.rows[0].usage_json).toBeNull();
  expect((await service.query(projectId)).rows).toHaveLength(3);
  expect((await service.query(projectId, { includeArchived: true })).rows).toHaveLength(4);
  expect((await service.query(projectId, { status: [] })).rows).toEqual([]);
  await expect(service.query(projectId, { status: ["invalid" as never] })).rejects.toThrow("Invalid session status");
});

test("workspace membership filters do not duplicate sessions and report the selected workspace", async () => {
  const workspaces = createWorkspacesDBService(conn.db);
  const a = await workspaces.create({ project_id: projectId, shorthand_base: "A" });
  const b = await workspaces.create({ project_id: projectId, shorthand_base: "B" });
  const row = await create("linked");
  await conn.db.insert(workspace_sessions).values([
    { id: "a", workspace_id: a.id, session_id: row.id, created_at: "2026-10-01" },
    { id: "b", workspace_id: b.id, session_id: row.id, created_at: "2026-10-02" },
  ]);
  expect((await service.query(projectId)).rows).toMatchObject([{ id: row.id, workspace_id: a.id }]);
  expect((await service.query(projectId, { workspaceId: b.id })).rows).toMatchObject([
    { id: row.id, workspace_id: b.id },
  ]);
});

test("default and maximum pages stay bounded while HTTP can read the complete result", async () => {
  await conn.db.insert(sessions).values(
    Array.from({ length: 205 }, (_, index) => ({
      id: `session-${String(index).padStart(3, "0")}`,
      project_id: projectId,
      title: "page",
      agent: "codex",
      created_at: "2026-10-01T00:00:00.000Z",
      updated_at: "2026-10-01T00:00:00.000Z",
    })),
  );
  expect((await service.query(projectId)).rows).toHaveLength(50);
  const page = await service.query(projectId, { limit: 1000 });
  expect(page.rows).toHaveLength(200);
  expect((await service.query(projectId, { cursor: page.nextCursor! })).rows).toHaveLength(5);
  expect((await service.query(projectId, {}, { unpaged: true })).rows).toHaveLength(205);
});

test("time bounds match equivalent ISO instants with offsets and different precision", async () => {
  const row = await create("instant");
  expect(
    (
      await service.query(projectId, {
        createdFrom: "2026-10-01T02:00:00+02:00",
        createdTo: "2026-09-30T20:00:00-04:00",
        updatedFrom: "2026-10-01T00:00:00Z",
      })
    ).rows.map((session) => session.id),
  ).toEqual([row.id]);
});

test("malformed cursor fields restart from the first page", async () => {
  const row = await create("cursor");
  const cursor = Buffer.from(JSON.stringify({ projectId, createdAt: "", id: "" })).toString("base64url");
  expect((await service.query(projectId, { cursor })).rows.map((session) => session.id)).toEqual([row.id]);
});
