import type { CommandParamValue } from "@pstdio/workbench/react";

// Command param values cross the dialog as plain strings; structured params
// (harness/repo) are JSON-encoded so the backend receives an object.
export const parseParamRecord = (value: CommandParamValue) => {
  if (typeof value !== "string" || value.length === 0) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

export const serializeParamRecord = (record: Record<string, unknown>) => JSON.stringify(record);
