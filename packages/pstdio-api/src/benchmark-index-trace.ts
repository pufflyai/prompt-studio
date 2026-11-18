import { appendFile } from "node:fs/promises";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { type DbClient, sql } from "pstdio-db";
import type { AppBindings } from "./types";

const readIndexCounters = async (db: DbClient) => {
  await db.execute(sql`select pg_stat_force_next_flush()`);
  const result = await db.execute<{ physical_name: string; logical_name: string | null; scanned: string }>(sql`
    select stats.indexrelname as physical_name, declared.name as logical_name, stats.idx_tup_read as scanned
    from pg_stat_user_indexes stats
    left join storage_record_indexes declared
      on stats.indexrelname = declared.database_name
      or starts_with(stats.indexrelname, declared.database_name || '_')
    where stats.relname = 'storage_current_records'
    order by stats.indexrelname`);
  return result.rows;
};

const plannerRead = /^pstdio\.(?:pstdio-)?planner\.(?:page\.tickets\.\$main\.tab\.query|view\.tickets\.kanban\.query)$/;

export const registerBenchmarkIndexTrace = (app: OpenAPIHono<AppBindings>, db: DbClient) => {
  const output = process.env.BENCHMARK_RESULTS;
  if (!output || process.env.PSTDIO_BENCHMARK_COUNTERS !== "1") return;
  let active = false;
  let sequence = 0;
  app.use("/runtime/benchmark-counters", async (context, next) => {
    await next();
    if (!context.res.ok) return;
    active = !active;
    await appendFile(`${output}.index-reads.jsonl`, `${JSON.stringify(await readIndexCounters(db))}\n`);
  });
  app.use("/v1/projects/:projectId/extensions/commands/:command/execute", async (context, next) => {
    const command = context.req.param("command");
    if (!active || context.req.method !== "POST" || !plannerRead.test(command)) return next();

    const id = sequence++;
    const began = performance.now();
    const before = await readIndexCounters(db);
    await next();
    const after = await readIndexCounters(db);
    const reads = new Map(before.map((index) => [index.physical_name, Number(index.scanned)]));
    // Snapshots can overlap when the browser issues concurrent reads. Retain their
    // execution intervals so a shared index delta is never counted twice.
    const evidence = {
      id,
      command,
      began,
      ended: performance.now(),
      status: context.res.status,
      indexes: after
        .map((index) => ({
          ...index,
          scanned: Number(index.scanned) - (reads.get(index.physical_name) ?? 0),
        }))
        .filter(({ scanned }) => scanned > 0),
    };
    await appendFile(`${output}.command-index-reads.jsonl`, `${JSON.stringify(evidence)}\n`);
  });
};
