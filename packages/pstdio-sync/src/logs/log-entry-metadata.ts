export interface LogEntryHeader {
  id: string;
  writerId: string;
  createdAt: string;
  fingerprint: string;
}
export const readLogEntryHeader = (input: unknown): LogEntryHeader => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid log identity metadata");
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).length !== 4 ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.writerId !== "string" ||
    !value.writerId ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.fingerprint)
  )
    throw new Error("Invalid log identity metadata");
  return value as unknown as LogEntryHeader;
};
