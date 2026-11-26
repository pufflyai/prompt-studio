import type { currentRuntimeOperationOrigin } from "pstdio-diagnostics";
import type { StorageOwner } from "pstdio-sync";
import type { ArtifactProjectionRefusals } from "../artifact-projection-admission";
import type { DbOpenPhase } from "../connection.pglite";

type OperationOrigin = NonNullable<ReturnType<typeof currentRuntimeOperationOrigin>>;

/** Project host attribution onto the scalar fields the worker uses for admission and diagnostics. */
export const readDatabaseWorkerOrigin = (value: unknown) => {
  if (typeof value !== "object" || value === null) return;
  const { kind, name, id, projectId, extensionId } = value as Partial<Record<keyof OperationOrigin, unknown>>;
  if (kind !== "command" && kind !== "event" && kind !== "background" && kind !== "request") return;
  if (typeof name !== "string") return;
  return {
    kind,
    name,
    id: typeof id === "string" ? id : undefined,
    projectId: typeof projectId === "string" ? projectId : undefined,
    extensionId: typeof extensionId === "string" ? extensionId : undefined,
  } satisfies OperationOrigin;
};

export interface DatabaseWorkerOpenOptions {
  path?: string;
  indexNodesPath?: string;
  storageRoot?: string;
  deferCleanup?: boolean;
}

/** PGlite query options that can cross a thread: parsers travel as the type ids they leave unparsed. */
export interface RemoteQueryOptions {
  rowMode?: "array" | "object";
  rawTypes?: number[];
}

export type DatabaseWorkerRequest =
  | { type: "open"; options: DatabaseWorkerOpenOptions; reportLegacyConversionErrors: boolean }
  | { type: "abort" }
  | ({
      origin?: OperationOrigin;
    } & (
      | { type: "query"; id: number; sql: string; params?: unknown[]; options?: RemoteQueryOptions; txId?: number }
      | { type: "exec"; id: number; sql: string; txId?: number }
      | { type: "begin"; id: number }
    ))
  | { type: "end"; id: number; txId: number; commit: boolean }
  | { type: "cleanup"; id: number }
  /** The API thread's `stopped()` turned true; the running cleanup stops at its next check. */
  | { type: "stop-cleanup" }
  | { type: "close"; id: number };

type SerializedErrorDetail = SerializedDatabaseError | string | number | boolean | null | undefined;

export interface SerializedDatabaseError {
  name: string;
  message: string;
  stack?: string;
  cause?: SerializedErrorDetail;
  errors?: SerializedErrorDetail[];
  /** PGlite's DatabaseError fields, such as code, detail and constraint. */
  fields: Record<string, string | number | boolean | null>;
}

export type DatabaseWorkerMessage =
  | { type: "phase"; phase: DbOpenPhase }
  | { type: "legacy-conversion-failed"; owner: StorageOwner; backupPath?: string; error: SerializedDatabaseError }
  | {
      type: "opened";
      path: string;
      unadmittedOwners: { owner: StorageOwner; cause: SerializedDatabaseError }[];
      projectionRefusals?: ArtifactProjectionRefusals;
    }
  | { type: "open-failed"; error: SerializedDatabaseError }
  | ({ type: "reply"; id: number } & ({ ok: true; value: unknown } | { ok: false; error: SerializedDatabaseError }));

const isScalarErrorDetail = (value: unknown): value is string | number | boolean | null | undefined =>
  value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const scalarErrorFields = (error: Error) => {
  const fields: SerializedDatabaseError["fields"] = {};
  for (const [key, value] of Object.entries(error))
    if (key !== "cause" && key !== "errors" && isScalarErrorDetail(value) && value !== undefined) fields[key] = value;
  return fields;
};

// Keep nested migration diagnostics clone-safe and bounded even if causes refer to one another.
const MAX_ERROR_DETAILS = 32;
export const serializeDatabaseError = (error: unknown): SerializedDatabaseError => {
  let remaining = MAX_ERROR_DETAILS;
  const seen = new Set<Error>();
  const detail = (value: unknown): SerializedErrorDetail => {
    if (!isScalarErrorDetail(value)) return serialize(value);
    remaining--;
    return value;
  };
  const aggregateDetails = (error: AggregateError) => {
    const errors: SerializedErrorDetail[] = [];
    for (const child of error.errors) {
      if (remaining <= 0) break;
      errors.push(detail(child));
    }
    return errors;
  };
  const serialize = (value: unknown): SerializedDatabaseError => {
    remaining--;
    if (!(value instanceof Error)) return { name: "Error", message: String(value), fields: {} };
    const error: SerializedDatabaseError = {
      name: value.name,
      message: value.message,
      stack: value.stack,
      fields: scalarErrorFields(value),
    };
    if (value instanceof AggregateError) error.errors = [];
    if (remaining <= 0 || seen.has(value)) return error;
    seen.add(value);
    if (value.cause !== undefined) error.cause = detail(value.cause);
    if (value instanceof AggregateError) error.errors = aggregateDetails(value);
    seen.delete(value);
    return error;
  };
  return serialize(error);
};

const deserializeErrorDetail = (value: SerializedErrorDetail): unknown =>
  value && typeof value === "object" ? deserializeDatabaseError(value) : value;

export const deserializeDatabaseError = (serialized: SerializedDatabaseError): Error => {
  const options = serialized.cause === undefined ? undefined : { cause: deserializeErrorDetail(serialized.cause) };
  const error = serialized.errors
    ? new AggregateError(serialized.errors.map(deserializeErrorDetail), serialized.message, options)
    : new Error(serialized.message, options);
  Object.assign(error, serialized.fields);
  error.name = serialized.name;
  if (serialized.stack) error.stack = serialized.stack;
  return error;
};
