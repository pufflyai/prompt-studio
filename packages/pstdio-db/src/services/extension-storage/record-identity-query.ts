import { type SQL, sql } from "drizzle-orm";
import { projectionBytesTag, projectionStringTag } from "./record-projection-codec";

/** Core identities only admit valid PostgreSQL text. Invalid JSON string IDs cannot match one. */
export const identityQueryText = (value: SQL) => {
  // convert_from inherits the encoding argument's C collation. Align the CASE
  // with the existing resource_id primary key so equality stays an index probe.
  const bytes = sql`(${value} ->> ${projectionBytesTag})`;
  return sql`(CASE WHEN jsonb_typeof(${value}) = 'string' THEN ${value} #>> '{}'
    WHEN jsonb_typeof(${value}) = 'object' AND ${value} ? ${projectionStringTag} AND NOT (${bytes} ~ '^(..)*00' OR ${bytes} ~ '^(..)*ed[ab][0-9a-f][89ab][0-9a-f]')
      THEN convert_from(decode(${bytes}, 'hex'), 'UTF8') ELSE NULL END) COLLATE "default"`;
};
