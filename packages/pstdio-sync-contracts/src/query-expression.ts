import type { Json } from "./json";
import type { StoragePredicate } from "./record-query";

/** Declarative JSON operations. Missing values remain distinct from JSON null. */
export type StorageExpression =
  | { literal: Json }
  | { field: string; up?: number }
  | { variable: string }
  | { get: StorageExpression; key: string | number | StorageExpression }
  | {
      op:
        | "and"
        | "or"
        | "not"
        | "eq"
        | "gt"
        | "lt"
        | "equalsIgnoreCase"
        | "textContains"
        | "if"
        | "isString"
        | "isObject"
        | "isArray"
        | "isBoolean"
        | "isInteger"
        | "nonblank"
        | "missing"
        | "length"
        | "keys"
        | "unique"
        | "first"
        | "flatten";
      args: StorageExpression[];
    }
  | { each: StorageExpression; as: string; mode: "every" | "some" | "map" | "filter"; where: StorageExpression };

export interface StorageComputedField {
  type: "string" | "number" | "boolean" | "array" | "object";
  expression?: StorageExpression;
  /** First matching owner-scoped condition. Conditions refer to declared fields. */
  cases?: { when: StoragePredicate; value: Json }[];
  otherwise?: Json;
}

const operationArity = {
  and: [0, 64],
  or: [0, 64],
  not: [1, 1],
  eq: [2, 2],
  gt: [2, 2],
  lt: [2, 2],
  equalsIgnoreCase: [2, 2],
  textContains: [2, 2],
  if: [3, 3],
  isString: [1, 1],
  isObject: [1, 1],
  isArray: [1, 1],
  isBoolean: [1, 1],
  isInteger: [1, 1],
  nonblank: [1, 1],
  missing: [1, 1],
  length: [1, 1],
  keys: [1, 1],
  unique: [1, 1],
  first: [1, 1],
  flatten: [1, 1],
};

const children = (value: StorageExpression) => {
  if ("get" in value) return typeof value.key === "object" ? [value.get, value.key] : [value.get];
  if ("each" in value) return [value.each, value.where];
  if ("op" in value) return value.args;
  return [];
};

export const storageExpressionInfo = (expression: StorageExpression) => {
  let nodes = 0;
  let quantifiers = 0;
  let keys = false;
  const pending = [expression];
  while (pending.length) {
    const value = pending.pop()!;
    if (++nodes > 512) throw new Error("Query expression is too large");
    if ("each" in value) quantifiers++;
    if ("op" in value && value.op === "keys") keys = true;
    pending.push(...children(value));
  }
  return { nodes, quantifiers, keys };
};

const validateGet = (
  value: Extract<StorageExpression, { get: StorageExpression }>,
  visit: (child: StorageExpression) => void,
) => {
  visit(value.get);
  if (typeof value.key === "object") visit(value.key);
  else if (typeof value.key !== "string" && !Number.isSafeInteger(value.key)) throw new Error("Invalid expression key");
};
const validateEach = (
  value: Extract<StorageExpression, { each: StorageExpression }>,
  names: Set<string>,
  visit: (child: StorageExpression, scope: Set<string>) => void,
) => {
  if (!value.as || names.has(value.as) || !["every", "some", "map", "filter"].includes(value.mode))
    throw new Error("Invalid expression quantifier");
  visit(value.each, names);
  visit(value.where, new Set([...names, value.as]));
};
const validateOperation = (value: StorageExpression) => {
  if (!("op" in value) || !Object.hasOwn(operationArity, value.op) || !Array.isArray(value.args))
    throw new Error("Invalid expression operation");
  const [min, max] = operationArity[value.op];
  if (value.args.length < min || value.args.length > max) throw new Error("Invalid expression arguments");
};

const validateField = (
  value: Extract<StorageExpression, { field: string }>,
  field?: (name: string, up: number) => void,
) => {
  const up = value.up ?? 0;
  if (!Number.isInteger(up) || up < 0 || up > 8 || !field) throw new Error("Invalid expression field scope");
  field(value.field, up);
};

const validateVariable = (name: string, names: Set<string>) => {
  if (!names.has(name)) throw new Error(`Unknown expression variable: ${name}`);
};

/** Object-key handles retain exact identity for get/eq inside predicates; they are not selectable strings. */
export const validateStorageExpressionResult = (expression: StorageExpression, type: string) => {
  if (type !== "boolean" && storageExpressionInfo(expression).keys)
    throw new Error("Object keys can only be used in predicates or boolean computed fields");
};

export const validateStorageExpression = (
  expression: StorageExpression,
  field?: (name: string, up: number) => void,
  variables = new Set<string>(),
) => {
  if (JSON.stringify(expression).length > 65536) throw new Error("Query expression is too large");
  let nodes = 0;
  const visit = (value: StorageExpression, depth: number, quantifiers: number, names: Set<string>): void => {
    if (++nodes > 512 || depth > 24 || quantifiers > 3) throw new Error("Query expression is too large or deep");
    if (!value || typeof value !== "object") throw new Error("Invalid query expression");
    if ("literal" in value) return;
    if ("field" in value) {
      validateField(value, field);
      return;
    }
    if ("variable" in value) {
      validateVariable(value.variable, names);
      return;
    }
    if ("get" in value) {
      validateGet(value, (child) => visit(child, depth + 1, quantifiers, names));
      return;
    }
    if ("each" in value) {
      validateEach(value, names, (child, scope) => visit(child, depth + 1, quantifiers + 1, scope));
      return;
    }
    validateOperation(value);
    for (const child of value.args) visit(child, depth + 1, quantifiers, names);
  };
  visit(expression, 0, 0, variables);
  return nodes;
};

type Operation = Extract<StorageExpression, { op: string }>;
type ReadExpression = (value: StorageExpression) => Json | undefined;
const scalarOperations = {
  not: (a: Json | undefined) => a !== true,
  isString: (a: Json | undefined) => typeof a === "string",
  isBoolean: (a: Json | undefined) => typeof a === "boolean",
  isInteger: (a: Json | undefined) => typeof a === "number" && Number.isInteger(a),
  isArray: (a: Json | undefined) => Array.isArray(a),
  isObject: (a: Json | undefined) => a !== null && typeof a === "object" && !Array.isArray(a),
  nonblank: (a: Json | undefined) => typeof a === "string" && a.trim().length > 0,
  missing: (a: Json | undefined) => a === undefined,
  length: (a: Json | undefined) => (typeof a === "string" || Array.isArray(a) ? a.length : undefined),
  keys: (a: Json | undefined) =>
    a !== null && typeof a === "object" && !Array.isArray(a) ? Object.keys(a).sort() : undefined,
  unique: (a: Json | undefined) =>
    Array.isArray(a) && a.every((item) => item === null || typeof item !== "object")
      ? new Set(a).size === a.length
      : false,
  first: (a: Json | undefined) => (Array.isArray(a) ? a[0] : undefined),
  flatten: (a: Json | undefined) => (Array.isArray(a) ? a.flat(1) : undefined),
};
const compareExpression = (op: "gt" | "lt", a: Json | undefined, b: Json | undefined) => {
  if (typeof a === "string" && typeof b === "string") return op === "gt" ? a > b : a < b;
  return typeof a === "number" && typeof b === "number" && (op === "gt" ? a > b : a < b);
};
const evaluateOperation = (value: Operation, read: ReadExpression) => {
  if (value.op === "and") return value.args.every((arg) => read(arg) === true);
  if (value.op === "or") return value.args.some((arg) => read(arg) === true);
  if (value.op === "if") return read(value.args[read(value.args[0]) === true ? 1 : 2]);
  const a = read(value.args[0]);
  if (value.op === "eq") return (a === null || typeof a !== "object") && a === read(value.args[1]);
  if (value.op === "equalsIgnoreCase" || value.op === "textContains") {
    const b = read(value.args[1]);
    return compareTextExpression(value.op, a, b);
  }
  if (value.op === "gt" || value.op === "lt") return compareExpression(value.op, a, read(value.args[1]));
  return scalarOperations[value.op](a);
};
const compareTextExpression = (
  operation: "equalsIgnoreCase" | "textContains",
  a: Json | undefined,
  b: Json | undefined,
) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  return operation === "equalsIgnoreCase"
    ? a.toLowerCase() === b.toLowerCase()
    : a.toLowerCase().includes(b.toLowerCase());
};
const readExpressionKey = (value: Extract<StorageExpression, { get: StorageExpression }>, read: ReadExpression) => {
  const source = read(value.get);
  const key = typeof value.key === "object" ? read(value.key) : value.key;
  if (source === null || typeof source !== "object" || (typeof key !== "string" && typeof key !== "number"))
    return undefined;
  if (Array.isArray(source) && (!Number.isSafeInteger(key) || Number(key) < 0)) return undefined;
  return Object.hasOwn(source, key) ? (source as Record<string, Json>)[key] : undefined;
};
const evaluateEach = (
  value: Extract<StorageExpression, { each: StorageExpression }>,
  source: Json | undefined,
  work: number,
  budget: number,
  run: (item: Json, work: number) => Json | undefined,
) => {
  if (!Array.isArray(source)) return value.mode === "every" || value.mode === "some" ? false : undefined;
  const nextWork = work * Math.max(1, source.length);
  if (nextWork * storageExpressionInfo(value.where).nodes > budget)
    throw new Error("Query expression execution limit exceeded");
  if (value.mode === "every") return source.every((item) => run(item, nextWork) === true);
  if (value.mode === "some") return source.some((item) => run(item, nextWork) === true);
  if (value.mode === "filter") return source.filter((item) => run(item, nextWork) === true);
  return source.map((item) => run(item, nextWork) ?? null);
};

export const evaluateStorageExpression = (
  expression: StorageExpression,
  field?: (name: string, up: number) => Json | undefined,
  variables: Record<string, Json | undefined> = {},
) => {
  validateStorageExpression(expression, field ? () => {} : undefined, new Set(Object.keys(variables)));
  const budget = Math.floor(100000 / Math.max(1, storageExpressionInfo(expression).quantifiers));
  const evaluate = (value: StorageExpression, names: Record<string, Json | undefined>, work = 1): Json | undefined => {
    const read = (child: StorageExpression) => evaluate(child, names, work);
    if ("literal" in value) return value.literal;
    if ("field" in value) return field?.(value.field, value.up ?? 0);
    if ("variable" in value) return Object.hasOwn(names, value.variable) ? names[value.variable] : undefined;
    if ("get" in value) return readExpressionKey(value, read);
    if ("each" in value)
      return evaluateEach(value, read(value.each), work, budget, (item, nextWork) =>
        evaluate(value.where, { ...names, [value.as]: item }, nextWork),
      );
    return evaluateOperation(value, read);
  };
  return evaluate(expression, variables);
};
