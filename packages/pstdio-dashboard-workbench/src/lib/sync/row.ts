// Synced rows arrive with raw, loosely-typed database column values. These
// coercion helpers keep module data hooks readable.

export const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

export const bool = (value: unknown): boolean => value === true;

export const isNotDeleted = (row: { [key: string]: unknown }) => !row.deleted_at;
