import { type SQL, sql } from "drizzle-orm";
import { expressionLiteral } from "./query-expression-values";
import {
  projectionBytesTag,
  projectionFoldedTag,
  projectionStringTag,
  projectionSubstringBytes,
} from "./record-projection-codec";

export const stringBytesSql = (value: SQL, folded = false) => {
  const tag = folded ? projectionFoldedTag : projectionBytesTag;
  const text = sql`(${value} #>> '{}')`;
  const normalized = folded ? sql`lower(${text})` : text;
  // decode is immutable for expression indexes; protect literal backslashes.
  const bytes = sql`decode(replace(${normalized}, ${expressionLiteral("\\")}, ${expressionLiteral("\\\\")}), 'escape')`;
  return sql`(CASE WHEN jsonb_typeof(${value}) = 'object' AND ${value} ? ${expressionLiteral(projectionStringTag)}
    THEN decode(${value} ->> ${expressionLiteral(tag)}, 'hex')
    ELSE ${bytes} END)`;
};

export const recordTextMatch = (value: SQL, search: string, recursive: boolean) => {
  const needle = projectionSubstringBytes(search.toLowerCase());
  const matches = (text: SQL) => sql`position(decode(${needle}, 'hex') in ${stringBytesSql(text, true)}) > 0`;
  if (!recursive) return matches(value);
  // String normalization references its input in several branches. Evaluate the
  // recursive projection once and let those branches reuse its result.
  return sql`(WITH breadcrumb_value AS MATERIALIZED (SELECT ${value} AS value)
    SELECT ${matches(sql`breadcrumb_value.value`)} FROM breadcrumb_value)`;
};

const byte = (value: SQL) => sql`lpad(to_hex(${value}), 2, '0')`;
const utf8 = (point: SQL): SQL => sql`CASE
  WHEN ${point} < 128 THEN ${byte(point)}
  WHEN ${point} < 2048 THEN ${byte(sql`192 | (${point} >> 6)`)} || ${byte(sql`128 | (${point} & 63)`)}
  WHEN ${point} < 65536 THEN ${byte(sql`224 | (${point} >> 12)`)} || ${byte(sql`128 | ((${point} >> 6) & 63)`)} || ${byte(sql`128 | (${point} & 63)`)}
  ELSE ${byte(sql`240 | (${point} >> 18)`)} || ${byte(sql`128 | ((${point} >> 12) & 63)`)} || ${byte(sql`128 | ((${point} >> 6) & 63)`)} || ${byte(sql`128 | (${point} & 63)`)} END`;

/** Build all codec tags from the final UTF-16 sequence, including pairs crossing joined fragments. */
export const queryStringFromHex = (hex: SQL) => {
  const point = sql`point`;
  const sentinel = "\ue000",
    end = "\ue001";
  const folded = sql`CASE WHEN point < 65536 THEN ${utf8(point)} ELSE
    (${utf8(sql`55296 + ((point - 65536) >> 10)`)}) || (${utf8(sql`56320 + ((point - 65536) & 1023)`)}) END`;
  return sql`(WITH encoded AS MATERIALIZED (SELECT ${hex} AS hex),
    bytes AS (SELECT decode(hex, 'hex') AS value FROM encoded),
    units AS (
      SELECT ordinal, get_byte(value, ordinal * 2) + 256 * get_byte(value, ordinal * 2 + 1) AS unit
      FROM bytes CROSS JOIN LATERAL generate_series(0, octet_length(value) / 2 - 1) AS ordinal
    ), neighbors AS (
      SELECT *, lag(unit) OVER (ORDER BY ordinal) AS previous, lead(unit) OVER (ORDER BY ordinal) AS next FROM units
    ), points AS MATERIALIZED (
      SELECT ordinal, CASE WHEN unit BETWEEN 55296 AND 56319 AND next BETWEEN 56320 AND 57343
        THEN 65536 + ((unit - 55296) << 10) + next - 56320 ELSE unit END AS point
      FROM neighbors WHERE NOT (unit BETWEEN 56320 AND 57343 AND coalesce(previous BETWEEN 55296 AND 56319, false))
    ), safe AS (
      SELECT coalesce(string_agg(CASE WHEN point = 0 OR point BETWEEN 55296 AND 57343 OR point IN (57344, 57345)
        THEN ${expressionLiteral(sentinel)} || point::text || ${expressionLiteral(end)} ELSE chr(point) END, '' ORDER BY ordinal), '') AS value FROM points
    ), lowered AS (
      SELECT lower(value COLLATE "und-x-icu") COLLATE "C" AS value FROM safe
    ), folded_points AS (
      SELECT ordinal, CASE WHEN parts[1] IS NOT NULL THEN parts[1]::integer ELSE ascii(parts[2]) END AS point
      FROM lowered CROSS JOIN LATERAL regexp_matches(value, ${expressionLiteral(`${sentinel}([0-9]+)${end}|(.)`)}, 'gs') WITH ORDINALITY AS matches(parts, ordinal)
    ) SELECT CASE WHEN (SELECT hex FROM encoded) IS NULL THEN NULL
    WHEN (SELECT hex FROM encoded) ~ '^(?:[0-7][0-9a-f]00)*$' AND (SELECT hex FROM encoded) !~ '^(....)*0000'
      THEN to_jsonb(convert_from(decode(regexp_replace((SELECT hex FROM encoded), '(..)00', ${expressionLiteral("\\1")}, 'g'), 'hex'), 'UTF8'))
    ELSE jsonb_build_object(
      ${expressionLiteral(projectionStringTag)}, (SELECT hex FROM encoded),
      ${expressionLiteral(projectionBytesTag)}, (SELECT coalesce(string_agg(${utf8(point)}, '' ORDER BY ordinal), '') FROM points),
      ${expressionLiteral(projectionFoldedTag)}, (SELECT coalesce(string_agg(${folded}, '' ORDER BY ordinal), '') FROM folded_points)
    ) END)`;
};
