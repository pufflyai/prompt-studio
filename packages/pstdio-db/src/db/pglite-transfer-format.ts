import type { PGlite } from "@electric-sql/pglite";

export type TransferDatabase = Pick<PGlite, "query" | "exec">;
export interface TransferColumn {
  name: string;
  type: string;
  binary: boolean;
  primary: boolean;
}
export interface TransferFile {
  name: string;
  sha256: string;
}
export interface TransferBinary {
  column: string;
  keys: string[];
  length: number;
  sha256: string;
  files: TransferFile[];
}
export interface TransferTable {
  name: string;
  columns: TransferColumn[];
  rows: number;
  files: TransferFile[];
  binary: TransferBinary[];
}
export interface TransferArchive {
  tables: TransferTable[];
  sequences: { name: string; value: string; called: boolean }[];
}
export const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
export const binaryInlineLimit = 64 * 1024;
export const binarySliceBytes = 512 * 1024;
