import { sql } from "drizzle-orm";
import { createDb } from "../../db/connection.pglite";
import { projects, storage_log_streams } from "../../db/schemas.pg";

const connection = await createDb({ path: ":memory:" });
try {
  const { db } = connection;
  const now = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: "plan-project", name: "Plan", shorthand: "P", created_at: now, updated_at: now });
  await db.insert(storage_log_streams).values({
    workbench_id: "plan-project",
    extension_id: "logs",
    log_name: "runs",
    scope: "project",
    stream: "project",
  });
  await db.execute(sql`INSERT INTO storage_log_entries(workbench_id,extension_id,log_name,scope,stream,entry_id,writer_id,created_at,fingerprint,entry,local,relay_sequence,relay_index)
    SELECT 'plan-project','logs','runs','project','project','entry-' || n,'laptop',1,'fingerprint',decode('7b7d','hex'),false,((n-1)/100)+1,(n-1)%100 FROM generate_series(1,100001) n`);
  const predicates = {
    original: sql`(relay_sequence > 1000 OR (relay_sequence = 1000 AND relay_index > 2147483647))`,
    tuple: sql`(relay_sequence,relay_index) > (1000,2147483647)`,
  };
  for (const [name, cursor] of Object.entries(predicates)) {
    const result = await db.execute(
      sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM storage_log_entries WHERE workbench_id='plan-project' AND extension_id='logs' AND log_name='runs' AND scope='project' AND stream='project' AND created_at >= 0 AND ${cursor} ORDER BY relay_sequence, relay_index LIMIT 100`,
    );
    console.log(JSON.stringify({ name, result }));
  }
} finally {
  await connection.close();
}
