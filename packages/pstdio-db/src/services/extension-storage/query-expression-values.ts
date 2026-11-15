import { type SQL, sql } from "drizzle-orm";
import { recordNumberTextSql } from "./record-number-text";
import { projectionFoldedTag, projectionKey, projectionStringTag } from "./record-projection-codec";

export const expressionLiteral = (value: string) => sql.raw(`'${value.replaceAll("'", "''")}'`);
export const expressionString = (value: SQL) =>
  sql`(jsonb_typeof(${value}) = 'string' OR (jsonb_typeof(${value}) = 'object' AND ${value} ? ${expressionLiteral(projectionStringTag)}))`;
export const expressionObject = (value: SQL) =>
  sql`(jsonb_typeof(${value}) = 'object' AND NOT (${value} ? ${expressionLiteral(projectionStringTag)}))`;
export const expressionFoldedBytes = (value: SQL) =>
  sql`CASE WHEN jsonb_typeof(${value}) = 'object' AND ${value} ? ${expressionLiteral(projectionStringTag)} THEN decode(${value} ->> ${expressionLiteral(projectionFoldedTag)}, 'hex') ELSE convert_to(lower(${value} #>> '{}'), 'UTF8') END`;
const unitHex = (code: SQL) => sql`lpad(to_hex((${code}) % 256), 2, '0') || lpad(to_hex((${code}) / 256), 2, '0')`;
export const expressionHex = (value: SQL) => {
  const text = sql`(${value} #>> '{}')`;
  const code = sql`ascii(units.character)`;
  return sql`(CASE WHEN ${value} ? ${expressionLiteral(projectionStringTag)} THEN ${value} ->> ${expressionLiteral(projectionStringTag)}
    WHEN octet_length(${text}) = length(${text}) THEN regexp_replace(encode(convert_to(${text}, 'UTF8'), 'hex'), '(..)', ${expressionLiteral("\\100")}, 'g')
    ELSE (SELECT coalesce(string_agg(CASE WHEN ${code} < 65536 THEN ${unitHex(code)}
      ELSE ${unitHex(sql`55296 + ((${code} - 65536) / 1024)`)} || ${unitHex(sql`56320 + ((${code} - 65536) % 1024)`)} END, '' ORDER BY units.position), '')
      FROM regexp_split_to_table(${text}, '') WITH ORDINALITY AS units(character, position)) END)`;
};
export const expressionComparable = (value: SQL) => {
  const input = sql`comparable_input.value`;
  // Related and computed inputs can be substantial queries. Bind once rather
  // than expanding their SQL at every type/encoding check (including nested normalization).
  return sql`(SELECT CASE WHEN ${expressionString(input)}
    THEN jsonb_build_object(${expressionLiteral(projectionStringTag)}, ${expressionHex(input)}) ELSE ${input} END
    FROM (SELECT ${value} AS value OFFSET 0) AS comparable_input)`;
};

export const expressionGet = (source: SQL, key: SQL, literal?: string | number) => {
  const objectKey =
    typeof literal === "string"
      ? expressionLiteral(projectionKey(literal))
      : sql`(CASE
    WHEN jsonb_typeof(${key}) = 'number' THEN ${recordNumberTextSql(key)}
    WHEN ${key} ? ${expressionLiteral(projectionStringTag)} OR left(${key} #>> '{}', 1) = ${expressionLiteral("\u0001")} OR octet_length(${key} #>> '{}') <> length(${key} #>> '{}')
      THEN ${expressionLiteral("\u0001k")} || ${expressionHex(key)}
    ELSE ${key} #>> '{}' END)`;
  const numeric = sql`CASE WHEN jsonb_typeof(${key}) = 'number' THEN CASE WHEN (${key} #>> '{}')::numeric BETWEEN 0 AND 2147483647
    AND trunc((${key} #>> '{}')::numeric) = (${key} #>> '{}')::numeric
    THEN (${key} #>> '{}')::integer ELSE NULL END ELSE NULL END`;
  return sql`(CASE WHEN ${expressionObject(source)} AND (${expressionString(key)} OR jsonb_typeof(${key}) = 'number') THEN ${source} -> ${objectKey}
    WHEN jsonb_typeof(${source}) = 'array' THEN ${source} -> (${numeric}) ELSE NULL END)`;
};

export const expressionKeys = (source: SQL, alias: string) => {
  const name = sql.identifier(alias);
  const key = sql`${name}.key`;
  const decoded = sql`CASE WHEN left(${key}, 2) = ${expressionLiteral("\u0001k")}
    THEN jsonb_build_object(${expressionLiteral(projectionStringTag)}, substring(${key} from 3)) ELSE to_jsonb(${key}) END`;
  const order = sql`regexp_replace(${expressionHex(decoded)}, '(..)(..)', ${expressionLiteral("\\2\\1")}, 'g') COLLATE "C"`;
  return sql`(CASE WHEN ${expressionObject(source)} THEN
    (SELECT coalesce(jsonb_agg(${decoded} ORDER BY ${order}), '[]'::jsonb)
     FROM jsonb_object_keys(CASE WHEN ${expressionObject(source)} THEN ${source} ELSE '{}'::jsonb END) AS ${name}(key))
    ELSE NULL END)`;
};

export const expressionArray = (source: SQL) =>
  sql`(CASE WHEN jsonb_typeof(${source}) = 'array' THEN ${source} ELSE '[]'::jsonb END)`;
export const expressionBoolean = (condition: SQL) => sql`to_jsonb(coalesce((${condition}), false))`;
export const expressionTrue = (value: SQL) => sql`(${value} = 'true'::jsonb)`;

// These are the ECMAScript trim code units, represented as UTF-16LE hex.
const whitespace = [
  0x9,
  0xa,
  0xb,
  0xc,
  0xd,
  0x20,
  0xa0,
  0x1680,
  ...Array.from({ length: 11 }, (_, i) => 0x2000 + i),
  0x2028,
  0x2029,
  0x202f,
  0x205f,
  0x3000,
  0xfeff,
];
export const expressionBlankPattern = `^(?:${whitespace.map((unit) => Buffer.from(String.fromCharCode(unit), "utf16le").toString("hex")).join("|")})*$`;
