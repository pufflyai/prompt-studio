import { sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";

const captureBytes = 4 * 1024 * 1024;
type SourcePosition = Record<string, unknown> & { encoded_bytes: number };
const keyTuple = (keys: readonly string[]) =>
  sql`(${sql.join(
    keys.map((key) => sql.identifier(key)),
    sql`, `,
  )})`;
const positionTuple = (keys: readonly string[], position: Record<string, unknown>) =>
  sql`(${sql.join(
    keys.map((key) => sql`${position[key]}`),
    sql`, `,
  )})`;
function* byteBoundedGroups(positions: SourcePosition[]) {
  for (let start = 0; start < positions.length; ) {
    let end = start + 1;
    let bytes = positions[start].encoded_bytes;
    while (end < positions.length && bytes + positions[end].encoded_bytes <= captureBytes) {
      bytes += positions[end++].encoded_bytes;
    }
    // A previously supported value larger than the batch target is copied alone, never truncated.
    yield { first: start, last: positions[end - 1] };
    start = end;
  }
}
export async function* readUpgradeRows(db: DbClient, source: { table: string; keys: readonly string[] }) {
  let after: Record<string, unknown> | undefined;
  for (;;) {
    const key = keyTuple(source.keys);
    const boundary = after ? sql`WHERE ${key} > ${positionTuple(source.keys, after)}` : sql``;
    // Fetch keys/sizes first, not 200 potentially huge settings values. The metadata page
    // is reused across byte groups, so oversized values are not repeatedly measured.
    const { rows: positions } = await db.execute<SourcePosition>(sql`
      SELECT ${sql.join(
        source.keys.map((key) => sql.identifier(key)),
        sql`, `,
      )},
        octet_length(row_to_json(t)::text) AS encoded_bytes
      FROM ${sql.identifier(source.table)} t ${boundary} ORDER BY ${sql.join(
        source.keys.map((key) => sql.identifier(key)),
        sql`, `,
      )} LIMIT 200
    `);
    if (!positions.length) break;
    for (const group of byteBoundedGroups(positions)) {
      const lower = group.first ? positions[group.first - 1] : after;
      const start = lower ? sql`${key} > ${positionTuple(source.keys, lower)} AND` : sql``;
      const { rows } = await db.execute<Record<string, unknown>>(sql`SELECT * FROM ${sql.identifier(source.table)}
        WHERE ${start} ${key} <= ${positionTuple(source.keys, group.last)}
        ORDER BY ${sql.join(
          source.keys.map((key) => sql.identifier(key)),
          sql`, `,
        )} LIMIT 200`);
      for (const row of rows) yield row;
    }
    after = positions.at(-1);
  }
}
