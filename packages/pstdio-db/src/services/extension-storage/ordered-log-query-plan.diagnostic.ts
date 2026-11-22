import { sql } from "drizzle-orm";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";

import { lockLogStream } from "./ordered-log-sql";

const connection = await createDb({ path: ":memory:" });
try {
  const { db } = connection;
  const now = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: "plan-project", name: "Plan", shorthand: "P", created_at: now, updated_at: now });
  const stream = await db.transaction((tx) =>
    lockLogStream(tx, {
      owner: { workbenchId: "plan-project", extensionId: "logs" },
      name: "runs",
      scope: "project",
      stream: "project",
      writerId: "laptop",
    }),
  );
  await db.execute(sql`INSERT INTO log_entries(stream_id,entry_id,writer_id,created_at,fingerprint,entry,local,relay_sequence,relay_index)
    SELECT ${stream.id},'entry-' || n,'laptop',1,'fingerprint',decode('7b7d','hex'),false,((n-1)/100)+1,(n-1)%100 FROM generate_series(1,100001) n`);
  const predicates = {
    original: sql`(relay_sequence > 1000 OR (relay_sequence = 1000 AND relay_index > 2147483647))`,
    tuple: sql`(relay_sequence,relay_index) > (1000,2147483647)`,
  };
  for (const [name, cursor] of Object.entries(predicates)) {
    const result = await db.execute(
      sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM log_entries WHERE stream_id=${stream.id} AND created_at >= 0 AND ${cursor} ORDER BY relay_sequence, relay_index LIMIT 100`,
    );
    console.log(JSON.stringify({ name, result }));
  }
} finally {
  await connection.close();
}
