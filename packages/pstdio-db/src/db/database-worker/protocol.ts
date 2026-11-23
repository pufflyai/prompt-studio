import type { DbOpenPhase } from "../connection.pglite";

export interface DatabaseWorkerOpenOptions {
  path?: string;
  indexNodesPath?: string;
  deferCleanup?: boolean;
}

/** PGlite query options that can cross a thread: parsers travel as the type ids they leave unparsed. */
export interface RemoteQueryOptions {
  rowMode?: "array" | "object";
  rawTypes?: number[];
}

export type DatabaseWorkerRequest =
  | { type: "open"; options: DatabaseWorkerOpenOptions }
  | { type: "abort" }
  | { type: "query"; id: number; sql: string; params?: unknown[]; options?: RemoteQueryOptions; txId?: number }
  | { type: "exec"; id: number; sql: string; txId?: number }
  | { type: "begin"; id: number }
  | { type: "end"; id: number; txId: number; commit: boolean }
  | { type: "cleanup"; id: number }
  /** The API thread's `stopped()` turned true; the running cleanup stops at its next check. */
  | { type: "stop-cleanup" }
  | { type: "close"; id: number };

export interface SerializedDatabaseError {
  name: string;
  message: string;
  stack?: string;
  /** PGlite's DatabaseError fields, such as code, detail and constraint. */
  fields: Record<string, string | number | boolean | null>;
}

export type DatabaseWorkerMessage =
  | { type: "phase"; phase: DbOpenPhase }
  | { type: "opened"; path: string }
  | { type: "open-failed"; error: SerializedDatabaseError }
  | ({ type: "reply"; id: number } & ({ ok: true; value: unknown } | { ok: false; error: SerializedDatabaseError }));

export const serializeDatabaseError = (error: unknown): SerializedDatabaseError => {
  if (!(error instanceof Error)) return { name: "Error", message: String(error), fields: {} };
  const fields: SerializedDatabaseError["fields"] = {};
  for (const [key, value] of Object.entries(error))
    if (value === null || ["string", "number", "boolean"].includes(typeof value))
      fields[key] = value as string | number | boolean | null;
  return { name: error.name, message: error.message, stack: error.stack, fields };
};

export const deserializeDatabaseError = (serialized: SerializedDatabaseError) => {
  const error = Object.assign(new Error(serialized.message), serialized.fields);
  error.name = serialized.name;
  if (serialized.stack) error.stack = serialized.stack;
  return error;
};
