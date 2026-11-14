import type { OpenAPIHono } from "@hono/zod-openapi";
import { type DbClient, sql } from "pstdio-db";
import type { RuntimeHost } from "./features/runtime/routes";
import { isRuntimeBearerAuthorized, isRuntimeOriginAllowed } from "./features/runtime/runtime-auth";
import type { AppBindings } from "./types";

/** Passive native counters for the frozen workloads. Never enabled in a normal product home. */
export const registerBenchmarkCounters = (app: OpenAPIHono<AppBindings>, db: DbClient, host?: RuntimeHost) => {
  if (!host || process.env.PSTDIO_BENCHMARK_COUNTERS !== "1") return;
  app.get("/runtime/benchmark-counters", async (c) => {
    const security = { token: host.token, origin: host.origin };
    if (!isRuntimeOriginAllowed(c.req.raw, security)) return c.json({ error: "Forbidden" }, 403);
    if (!isRuntimeBearerAuthorized(c.req.raw, security)) return c.json({ error: "Unauthorized" }, 401);
    await db.execute(sql`select pg_stat_force_next_flush()`);
    const table = await db.execute<{ scanned: string; returned: string; writes: string }>(sql`
      select seq_tup_read as scanned, idx_tup_fetch as returned, n_tup_ins+n_tup_upd+n_tup_del as writes
      from pg_stat_user_tables where relname='storage_current_records'`);
    const index = await db.execute<{ scanned: string }>(sql`
      select coalesce(sum(idx_tup_read),0) as scanned from pg_stat_user_indexes where relname='storage_current_records'`);
    if (table.rows.length !== 1) throw new Error("Missing record projection counters");
    c.header("cache-control", "no-store");
    return c.json({
      sequentialRows: Number(table.rows[0]!.scanned),
      indexEntries: Number(index.rows[0]!.scanned),
      writes: Number(table.rows[0]!.writes),
    });
  });
};
