import type { CommandFailureDetails, CommandReject } from "pstdio-api-contracts/extension-kernel";

const rejects = new WeakMap<object, CommandFailureDetails>();

export const createCommandRejection = (details: CommandFailureDetails): CommandReject => {
  const value: CommandReject = { type: "reject", ...details };
  rejects.set(value, { ...details });
  return value;
};

export const readCommandRejection = (error: unknown, signal: AbortSignal) => {
  const value: unknown = error instanceof Error ? error.cause : error;
  return !signal.aborted && typeof value === "object" && value !== null ? rejects.get(value) : undefined;
};
