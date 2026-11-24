import { type SQL, sql } from "drizzle-orm";
import { type StorageExpression, storageExpressionInfo } from "pstdio-sync-contracts";
import {
  expressionArray,
  expressionBlankPattern,
  expressionBoolean,
  expressionComparable,
  expressionFoldedBytes,
  expressionGet,
  expressionHex,
  expressionKeys,
  expressionLiteral,
  expressionObject,
  expressionString,
  expressionTrue,
} from "./query-expression-values";
import { encodeProjectionValue } from "./record-projection-codec";

export const queryExpressionBudget = (expression: StorageExpression) =>
  Math.floor(100000 / Math.max(1, storageExpressionInfo(expression).quantifiers));

/** Compile only the validated declarative language; caller supplies owner-scoped field references. */
export const queryExpressionSql = (
  expression: StorageExpression,
  field: (name: string, up: number) => SQL,
  variables = new Map<string, SQL>(),
) => {
  let sequence = 0;
  const budget = queryExpressionBudget(expression);
  const bind = (values: SQL[], build: (values: SQL[]) => SQL) => {
    if (!values.length) return build([]);
    const alias = sql.identifier(`expression_input_${sequence++}`);
    const columns = values.map((value, i) => sql`${value} AS ${sql.identifier(`v${i}`)}`);
    const references = values.map((_, i) => sql`${alias}.${sql.identifier(`v${i}`)}`);
    return sql`(SELECT ${build(references)} FROM (SELECT ${sql.join(columns, sql`, `)} OFFSET 0) AS ${alias})`;
  };
  const operation = (value: Extract<StorageExpression, { op: string }>, args: SQL[]) => {
    const a = args[0];
    switch (value.op) {
      case "not":
        return expressionBoolean(sql`NOT coalesce(${expressionTrue(a)}, false)`);
      case "equalsIgnoreCase":
        return expressionBoolean(
          sql`${expressionString(a)} AND ${expressionString(args[1])} AND ${expressionFoldedBytes(a)} = ${expressionFoldedBytes(args[1])}`,
        );
      case "textContains":
        return expressionBoolean(sql`${expressionString(a)} AND ${expressionString(args[1])}
          AND position(${expressionFoldedBytes(args[1])} in ${expressionFoldedBytes(a)}) > 0`);
      case "gt":
      case "lt": {
        const operation = sql.raw(value.op === "gt" ? ">" : "<");
        const units = (value: SQL) =>
          sql`regexp_replace(${expressionHex(value)}, '(..)(..)', ${expressionLiteral("\\2\\1")}, 'g') COLLATE "C"`;
        return expressionBoolean(sql`CASE WHEN jsonb_typeof(${a}) = 'number' AND jsonb_typeof(${args[1]}) = 'number' THEN ${a} ${operation} ${args[1]}
          WHEN ${expressionString(a)} AND ${expressionString(args[1])} THEN ${units(a)} ${operation} ${units(args[1])} ELSE false END`);
      }
      case "eq":
        return expressionBoolean(sql`NOT coalesce(jsonb_typeof(${a}) IN ('object', 'array') AND NOT ${expressionString(a)}, false)
        AND NOT coalesce(jsonb_typeof(${args[1]}) IN ('object', 'array') AND NOT ${expressionString(args[1])}, false)
        AND ${expressionComparable(a)} IS NOT DISTINCT FROM ${expressionComparable(args[1])}`);
      case "isString":
        return expressionBoolean(expressionString(a));
      case "isObject":
        return expressionBoolean(expressionObject(a));
      case "isArray":
        return expressionBoolean(sql`jsonb_typeof(${a}) = 'array'`);
      case "isBoolean":
        return expressionBoolean(sql`jsonb_typeof(${a}) = 'boolean'`);
      case "isInteger":
        return expressionBoolean(
          sql`CASE WHEN jsonb_typeof(${a}) = 'number' THEN trunc((${a} #>> '{}')::numeric) = (${a} #>> '{}')::numeric ELSE false END`,
        );
      case "missing":
        return expressionBoolean(sql`${a} IS NULL`);
      case "nonblank":
        return expressionBoolean(
          sql`${expressionString(a)} AND ${expressionHex(a)} !~ ${expressionLiteral(expressionBlankPattern)}`,
        );
      case "length":
        return sql`(CASE WHEN ${expressionString(a)} THEN to_jsonb(length(${expressionHex(a)}) / 4) WHEN jsonb_typeof(${a}) = 'array' THEN to_jsonb(jsonb_array_length(${a})) ELSE NULL END)`;
      case "keys":
        return expressionKeys(a, `expression_keys_${sequence++}`);
      case "first":
        return sql`(CASE WHEN jsonb_typeof(${a}) = 'array' THEN ${a} -> 0 ELSE NULL END)`;
      case "flatten":
        return sql`(CASE WHEN jsonb_typeof(${a}) = 'array' THEN (
          SELECT coalesce(jsonb_agg(child.value ORDER BY parent.position, child.position), '[]'::jsonb)
          FROM jsonb_array_elements(${expressionArray(a)}) WITH ORDINALITY AS parent(value, position)
          CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(parent.value) = 'array'
            THEN parent.value ELSE jsonb_build_array(parent.value) END) WITH ORDINALITY AS child(value, position)
        ) ELSE NULL END)`;
      case "unique": {
        const alias = sql.identifier(`expression_unique_${sequence++}`);
        const item = sql`${alias}.value`;
        return expressionBoolean(
          sql`jsonb_typeof(${a}) = 'array' AND (SELECT count(*) = count(DISTINCT ${expressionComparable(item)}) AND coalesce(bool_and(NOT (jsonb_typeof(${item}) IN ('array', 'object') AND NOT ${expressionString(item)})), true) FROM jsonb_array_elements(${expressionArray(a)}) AS ${alias}(value))`,
        );
      }
    }
    throw new Error("Unsupported expression operation");
  };
  const compileEach = (
    value: Extract<StorageExpression, { each: StorageExpression }>,
    variables: Map<string, SQL>,
    work: SQL,
  ): SQL => {
    return bind([compile(value.each, variables, work)], ([source]) => {
      const alias = sql.identifier(`expression_${sequence++}`);
      const item = sql`${alias}.value`;
      const nextWork = sql`(${work} * greatest(1, jsonb_array_length(${expressionArray(source)})))`;
      const nested = new Map(variables).set(value.as, item);
      const body = compile(value.where, nested, nextWork);
      // Bound intermediate expansion, including correlated nested quantifiers. Exceeding it fails explicitly.
      const guard = (
        result: SQL,
      ) => sql`(CASE WHEN ${nextWork} * ${storageExpressionInfo(value.where).nodes} <= ${budget} THEN ${result}
        ELSE ('Query expression execution limit exceeded: ' || ${nextWork}::text)::jsonb END)`;
      const input = expressionArray(source);
      const from = sql`jsonb_array_elements(${input}) WITH ORDINALITY AS ${alias}(value, position)`;
      if (value.mode === "every")
        return guard(
          expressionBoolean(
            sql`jsonb_typeof(${source}) = 'array' AND NOT EXISTS (SELECT 1 FROM ${from} WHERE NOT coalesce(${expressionTrue(body)}, false))`,
          ),
        );
      if (value.mode === "some")
        return guard(
          expressionBoolean(
            sql`jsonb_typeof(${source}) = 'array' AND EXISTS (SELECT 1 FROM ${from} WHERE ${expressionTrue(body)})`,
          ),
        );
      const selected = value.mode === "map" ? sql`coalesce(${body}, 'null'::jsonb)` : item;
      const where = value.mode === "filter" ? sql`WHERE ${expressionTrue(body)}` : sql``;
      return guard(
        sql`(CASE WHEN jsonb_typeof(${source}) = 'array' THEN (SELECT coalesce(jsonb_agg(${selected} ORDER BY ${alias}.position), '[]'::jsonb) FROM ${from} ${where}) ELSE NULL END)`,
      );
    });
  };
  const compileGet = (
    value: Extract<StorageExpression, { get: StorageExpression }>,
    variables: Map<string, SQL>,
    work: SQL,
  ): SQL => {
    const source = compile(value.get, variables, work);
    const key =
      typeof value.key === "object"
        ? compile(value.key, variables, work)
        : sql`${JSON.stringify(encodeProjectionValue(value.key))}::jsonb`;
    return bind([source, key], ([source, key]) =>
      expressionGet(source, key, typeof value.key === "object" ? undefined : value.key),
    );
  };
  const compileBoolean = (
    value: Extract<StorageExpression, { op: string }>,
    variables: Map<string, SQL>,
    work: SQL,
  ): SQL => {
    let result: SQL = value.op === "and" ? sql`'true'::jsonb` : sql`'false'::jsonb`;
    for (const child of [...value.args].reverse()) {
      const test = expressionTrue(compile(child, variables, work));
      result =
        value.op === "and"
          ? sql`(CASE WHEN ${test} THEN ${result} ELSE 'false'::jsonb END)`
          : sql`(CASE WHEN ${test} THEN 'true'::jsonb ELSE ${result} END)`;
    }
    return result;
  };
  const compile = (value: StorageExpression, variables: Map<string, SQL>, work: SQL): SQL => {
    if ("literal" in value) return sql`${JSON.stringify(encodeProjectionValue(value.literal))}::jsonb`;
    if ("field" in value) return field(value.field, value.up ?? 0);
    if ("variable" in value) {
      const variable = variables.get(value.variable);
      if (!variable) throw new Error("Unknown expression variable");
      return variable;
    }
    if ("get" in value) return compileGet(value, variables, work);
    if ("each" in value) return compileEach(value, variables, work);
    if (value.op === "if")
      return bind(
        [compile(value.args[0], variables, work)],
        ([condition]) =>
          sql`(CASE WHEN ${expressionTrue(condition)} THEN ${compile(value.args[1], variables, work)} ELSE ${compile(value.args[2], variables, work)} END)`,
      );
    if (value.op === "and" || value.op === "or") return compileBoolean(value, variables, work);
    return bind(
      value.args.map((arg) => compile(arg, variables, work)),
      (args) => operation(value, args),
    );
  };
  return compile(expression, variables, sql`1`);
};
