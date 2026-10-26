import { createDb } from "../../db/connection.pglite";
import { sessions, workspace_sessions } from "../../db/schemas.pg";
import { createProjectsDBService } from "../projects/projects";
import { createWorkspacesDBService } from "../workspaces/workspaces";
import { createSessionsDBService } from "./sessions";

// An isolated in-memory database; this never opens the user's database.
const conn = await createDb({ path: ":memory:" });
try {
  const project = await createProjectsDBService(conn.db).create({ name: "Badge query benchmark" });
  const service = createSessionsDBService(conn.db);
  const workspaceService = createWorkspacesDBService(conn.db);
  const ids: string[] = [];
  const historySize = 1000;
  for (let index = 0; index < 28; index++) {
    const workspace = await workspaceService.create({ project_id: project.id, shorthand_base: `B${index}` });
    ids.push(workspace.id);
    const rows = Array.from({ length: historySize }, (_, offset) => ({
      id: `${workspace.id}-${String(offset).padStart(4, "0")}`,
      project_id: project.id,
      title: `Session ${offset}`,
      status: offset === 500 && index % 2 === 0 ? ("awaiting_input" as const) : ("completed" as const),
      archived: offset % 3 === 0,
      created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, offset)).toISOString(),
      updated_at: new Date(Date.UTC(2026, 0, 1, 0, 0, offset)).toISOString(),
    }));
    await conn.db.insert(sessions).values(rows);
    await conn.db.insert(workspace_sessions).values(
      rows.map((row) => ({
        id: `link-${row.id}`,
        workspace_id: workspace.id,
        session_id: row.id,
        created_at: row.created_at,
      })),
    );
  }

  for (let repeat = 0; repeat < 3; repeat++) {
    const strategies = repeat % 2 === 0 ? (["history", "badge"] as const) : (["badge", "history"] as const);
    for (const strategy of strategies) {
      let queries = 0;
      let returnedRows = 0;
      let active = 0;
      let peakActive = 0;
      const cpu = process.cpuUsage();
      const started = performance.now();
      const query = async (input: Parameters<typeof service.query>[1]) => {
        queries++;
        active++;
        peakActive = Math.max(peakActive, active);
        try {
          const result = await service.query(project.id, input);
          returnedRows += result.rows.length;
          return result;
        } finally {
          active--;
        }
      };
      const results = new Map<string, string | undefined>();
      const read = async (workspaceId: string) => {
        if (strategy === "badge") {
          const input = { workspaceId, includeArchived: true, limit: 1 };
          const active = await query({ ...input, status: ["queued", "in_progress", "awaiting_input"] });
          const row = active.rows[0] ?? (await query(input)).rows[0];
          results.set(workspaceId, row?.id);
          return;
        }
        let cursor: string | undefined;
        const rows = [];
        do {
          const page = await query({ workspaceId, includeArchived: true, limit: 200, cursor });
          rows.push(...page.rows);
          cursor = page.nextCursor ?? undefined;
        } while (cursor);
        results.set(
          workspaceId,
          (rows.find((row) => ["queued", "in_progress", "awaiting_input"].includes(row.status)) ?? rows[0])?.id,
        );
      };
      let cursor = 0;
      await Promise.all(
        Array.from({ length: strategy === "history" ? 28 : 4 }, async () => {
          while (cursor < ids.length) await read(ids[cursor++]);
        }),
      );
      for (const [index, id] of ids.entries()) {
        const expected = `${id}-${index % 2 === 0 ? "0500" : "0999"}`;
        if (results.get(id) !== expected) throw new Error(`Incorrect badge for ${id}`);
      }
      const used = process.cpuUsage(cpu);
      console.log(
        JSON.stringify({
          repeat,
          strategy,
          workspaces: ids.length,
          sessionsPerWorkspace: historySize,
          elapsedMs: Math.round(performance.now() - started),
          cpuMs: Math.round((used.user + used.system) / 1000),
          queries,
          returnedRows,
          peakActive,
        }),
      );
    }
  }
} finally {
  await conn.close();
}
