import type { StorageLogDefinition, StorageTextDeclaration } from "pstdio-api-contracts/extension-kernel";

const object = (input: unknown, keys: string[]) => {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Storage declaration must be an object");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new Error("Unknown storage declaration field");
  return value;
};
const text = (input: unknown) => {
  if (typeof input !== "string" || !input || input.includes("\0")) throw new Error("Log names must be nonempty text");
  return input;
};
const textFields = (input: unknown) => {
  if (input === undefined) return [];
  if (!Array.isArray(input)) throw new Error("Collaborative text declarations must be an array");
  return input.map((input) => {
    const value = object(input, ["prefix", "fields"]);
    if (typeof value.prefix !== "string" || !Array.isArray(value.fields) || !value.fields.length)
      throw new Error("Collaborative text requires a prefix and JSON Pointer fields");
    const fields = value.fields.map((field: unknown) => {
      if (typeof field !== "string" || (field !== "" && (!field.startsWith("/") || /~(?![01])/u.test(field))))
        throw new Error("Collaborative text fields use JSON Pointer addresses");
      return field;
    });
    if (new Set(fields).size !== fields.length) throw new Error("Collaborative text fields must be unique");
    return { prefix: value.prefix, fields } satisfies StorageTextDeclaration;
  });
};
const log = (input: unknown) => {
  const value = typeof input === "string" ? { name: input } : object(input, ["name", "writer", "keep"]);
  const name = text(value.name);
  const writer = value.writer ?? "project";
  if (writer !== "project" && writer !== "device") throw new Error("Log writer must be project or device");
  if (value.keep === undefined) return { name, writer } satisfies StorageLogDefinition;
  const keep = object(value.keep, ["days"]);
  if (typeof keep.days !== "number" || !Number.isFinite(keep.days) || keep.days <= 0)
    throw new Error("Log retention days must be positive");
  return { name, writer, keep: { days: keep.days } } satisfies StorageLogDefinition;
};
export const normalizeStorageDeclaration = (input: unknown) => {
  if (input === undefined) return undefined;
  const value = object(input, ["records", "logs"]);
  const records = value.records === undefined ? undefined : { text: textFields(object(value.records, ["text"]).text) };
  if (value.logs !== undefined && !Array.isArray(value.logs)) throw new Error("Logs must be an array");
  const logs = ((value.logs ?? []) as unknown[]).map(log);
  if (new Set(logs.map((log) => log.name)).size !== logs.length) throw new Error("Log names must be unique");
  return { ...(records && { records }), logs };
};
