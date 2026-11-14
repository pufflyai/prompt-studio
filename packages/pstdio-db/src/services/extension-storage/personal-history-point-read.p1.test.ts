import { expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { projects, storage_personal_history } from "../../db/schemas.pg";
import { createPersonalHistoryIndex } from "./personal-history-index";

test("a cold personal-history point read does not hydrate the owner's history", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const now = new Date().toISOString();
    await db
      .insert(projects)
      .values({ id: "history-scale", name: "History", shorthand: "H", created_at: now, updated_at: now });
    for (let offset = 0; offset < 5000; offset += 100)
      await db.insert(storage_personal_history).values(
        Array.from({ length: 100 }, (_, index) => ({
          workbench_id: "history-scale",
          extension_id: "private",
          device_id: "remote",
          kind: "sessions",
          record_id: `session-${String(offset + index).padStart(4, "0")}`,
          value: {
            id: `session-${String(offset + index).padStart(4, "0")}`,
            title: "History",
            project_id: "history-scale",
            device: { ownerId: "alice", id: "remote", name: "Remote" },
            status: "completed",
            archived: false,
            created_at: now,
            updated_at: now,
            anchors_json:
              offset + index < 205 ? [{ type: "ticket", id: "selected", extensionId: "pstdio.pstdio-planner" }] : [],
          },
        })),
      );
    const query = db.$client.query.bind(db.$client);
    let hydrated = 0;
    db.$client.query = async (...args: Parameters<typeof query>) => {
      const result = await query(...args);
      if (String(args[0]).includes('from "storage_personal_history"')) hydrated += result.rows.length;
      return result;
    };
    const index = createPersonalHistoryIndex(db);
    const owner = { workbenchId: "history-scale", extensionId: "private" };
    expect(await index.get(owner, "sessions", "session-0002")).toMatchObject({ id: "session-0002" });
    expect(hydrated).toBeLessThanOrEqual(1);
    hydrated = 0;
    const input = { anchor: { type: "ticket", id: "selected", extensionId: "pstdio.pstdio-planner" }, limit: 100 };
    const first = await index.querySessions(owner, { accountId: "alice", deviceId: "local" }, input);
    expect(first.rows).toHaveLength(100);
    expect(hydrated).toBeLessThanOrEqual(101);
    const second = await index.querySessions(
      owner,
      { accountId: "alice", deviceId: "local" },
      { ...input, cursor: first.nextCursor! },
    );
    const third = await index.querySessions(
      owner,
      { accountId: "alice", deviceId: "local" },
      { ...input, cursor: second.nextCursor! },
    );
    expect(second.rows).toHaveLength(100);
    expect(third.rows).toHaveLength(5);
    expect(new Set([...first.rows, ...second.rows, ...third.rows].map(({ id }) => id)).size).toBe(205);
    expect((await index.querySessions(owner, { accountId: "bob", deviceId: "local" }, input)).rows).toEqual([]);
    await db.insert(storage_personal_history).values({
      workbench_id: owner.workbenchId,
      extension_id: owner.extensionId,
      device_id: "remote",
      kind: "workspace_sessions",
      record_id: "membership",
      value: {
        id: "membership",
        workspace_id: "workspace",
        session_id: "session-4999",
        device: { ownerId: "alice", id: "remote", name: "Remote" },
      },
    });
    await db.insert(storage_personal_history).values({
      workbench_id: owner.workbenchId,
      extension_id: owner.extensionId,
      device_id: "remote",
      kind: "workspaces",
      record_id: "workspace",
      value: {
        id: "workspace",
        project_id: owner.workbenchId,
        archived: false,
        deleted_at: null,
        anchors_json: [{ type: input.anchor.type, id: input.anchor.id }],
        device: { ownerId: "alice", id: "remote", name: "Remote" },
      },
    });
    for (let offset = 0; offset < 5000; offset += 100)
      await db.insert(storage_personal_history).values(
        Array.from({ length: 100 }, (_, index) => ({
          workbench_id: owner.workbenchId,
          extension_id: owner.extensionId,
          device_id: "remote",
          kind: "workspaces",
          record_id: `ws-${String(offset + index).padStart(4, "0")}`,
          value: {
            id: `ws-${String(offset + index).padStart(4, "0")}`,
            project_id: owner.workbenchId,
            archived: offset + index === 205,
            deleted_at: null,
            anchors_json: offset + index <= 205 ? [input.anchor] : [],
            device: { ownerId: "alice", id: "remote", name: "Remote" },
          },
        })),
      );
    hydrated = 0;
    const workspaceInput = { anchors: [input.anchor], limit: 100 };
    const wsFirst = await index.queryWorkspaces(owner, { accountId: "alice", deviceId: "local" }, workspaceInput);
    expect(wsFirst.rows).toHaveLength(100);
    expect(hydrated).toBeLessThanOrEqual(101);
    const wsSecond = await index.queryWorkspaces(
      owner,
      { accountId: "alice", deviceId: "local" },
      { ...workspaceInput, cursor: wsFirst.nextCursor! },
    );
    const wsThird = await index.queryWorkspaces(
      owner,
      { accountId: "alice", deviceId: "local" },
      { ...workspaceInput, cursor: wsSecond.nextCursor! },
    );
    expect(wsSecond.rows).toHaveLength(100);
    expect(wsThird.rows).toHaveLength(6);
    expect(new Set([...wsFirst.rows, ...wsSecond.rows, ...wsThird.rows].map(({ id }) => id)).size).toBe(206);
    expect((await index.queryWorkspaces(owner, { accountId: "bob", deviceId: "local" }, workspaceInput)).rows).toEqual(
      [],
    );
    expect(
      (await index.queryWorkspaces(owner, { accountId: "alice", deviceId: "local" }, { anchors: [] })).rows,
    ).toEqual([]);
    expect(
      (
        await index.queryWorkspaces(
          owner,
          { accountId: "alice", deviceId: "local" },
          { anchors: [{ ...input.anchor, extensionId: "other" }] },
        )
      ).rows,
    ).toEqual([]);
    const scoped = await index.querySessions(
      owner,
      { accountId: "alice", deviceId: "local" },
      { ...input, includeWorkspaceAnchors: true },
    );
    expect(scoped.rows[0].id).toBe("session-4999");
    expect(
      (
        await index.querySessions(owner, { accountId: "alice", deviceId: "local" }, { workspaceId: "workspace" })
      ).rows.map(({ id }) => id),
    ).toEqual(["session-4999"]);
    expect(
      (await index.querySessions(owner, { accountId: "alice", deviceId: "local" }, { ...input, status: [] })).rows,
    ).toEqual([]);
    expect(
      (await index.querySessions(owner, { accountId: "alice", deviceId: "local" }, { ...input, status: ["completed"] }))
        .rows,
    ).toHaveLength(100);
  } finally {
    await close();
  }
});
