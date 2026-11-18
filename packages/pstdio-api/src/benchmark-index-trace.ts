import { appendFile } from "node:fs/promises";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { type DbClient, sql } from "pstdio-db";
import type { AppBindings } from "./types";

export const registerBenchmarkIndexTrace = (app: OpenAPIHono<AppBindings>, db: DbClient) => {
  const output = process.env.BENCHMARK_RESULTS;
  if (!output || process.env.PSTDIO_BENCHMARK_COUNTERS !== "1") return;
  app.use("/runtime/benchmark-counters", async (context, next) => {
    await next();
    if (!context.res.ok) return;
    // The unchanged benchmark reads these counters outside the measured journey.
    const result = await db.execute<{ physical_name: string; logical_name: string | null; scanned: string }>(sql`
      select stats.indexrelname as physical_name, declared.name as logical_name, stats.idx_tup_read as scanned
      from pg_stat_user_indexes stats
      left join storage_record_indexes declared
        on stats.indexrelname = declared.database_name
        or starts_with(stats.indexrelname, declared.database_name || '_')
      where stats.relname = 'storage_current_records'
      order by stats.indexrelname`);
    await appendFile(`${output}.index-reads.jsonl`, `${JSON.stringify(result.rows)}\n`);
  });
};
