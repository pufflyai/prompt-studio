import { type SQL, sql } from "drizzle-orm";
import { expressionLiteral } from "./query-expression-values";

export const recordIdentityPrefixBytes = 512;

// Record IDs share the same B-tree key budget as the declared sort fields.
// Decode text as bytes so the prefix stays bounded for multibyte IDs too.
export const recordIdentityPrefixSql = (value: SQL = sql`record_id`) =>
  sql`substring(decode(replace(${value}, ${expressionLiteral("\\")}, ${expressionLiteral("\\\\")}), 'escape') from 1 for ${sql.raw(String(recordIdentityPrefixBytes))})`;
