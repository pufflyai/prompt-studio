import type { SessionImportError as ImportError } from "pstdio-api-contracts";
import { exportedSessionSchema } from "./source";

export interface SessionImportRow {
  line: number;
  value?: unknown;
  error?: string;
}
export const parseImportRow = (row: SessionImportRow) => {
  if (row.error) throw new Error(row.error);
  return exportedSessionSchema.parse(row.value);
};
export const importRowError = (row: SessionImportRow, error: unknown) => {
  const id = row.value && typeof row.value === "object" && "id" in row.value ? row.value.id : undefined;
  const result: ImportError = {
    line: row.line,
    sessionId: typeof id === "string" ? id : undefined,
    error: error instanceof Error ? error.message : String(error),
  };
  return result;
};
