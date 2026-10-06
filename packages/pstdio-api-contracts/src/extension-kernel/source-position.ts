import type { FileSourcePosition } from "./types/pages";

export const isFileSourcePosition = (value: unknown): value is FileSourcePosition => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const position = value as FileSourcePosition;
  const positive = (number: unknown) => typeof number === "number" && Number.isSafeInteger(number) && number > 0;
  if (!positive(position.line)) return false;
  for (const key of ["column", "endLine", "endColumn"] as const) {
    if (position[key] !== undefined && !positive(position[key])) return false;
  }
  if (position.endColumn !== undefined && position.endLine === undefined) return false;
  if (position.endLine !== undefined) {
    if (position.endLine < position.line) return false;
    if (position.endLine === position.line && (position.endColumn ?? 1) < (position.column ?? 1)) return false;
  }
  return true;
};
