import type { CommandExecuteRequest, CommandExecuteResponse } from "@pstdio/sdk/api";

export const commandLogLimit = 100;

export type CommandCallLogEntry = {
  commandId: string;
  error?: string;
  id: string;
  request: CommandExecuteRequest;
  response?: CommandExecuteResponse;
  status: "pending" | "success" | "error";
};

export const recordCommandCallEntry = (current: CommandCallLogEntry[], entry: CommandCallLogEntry) => {
  const existing = current.some((call) => call.id === entry.id);
  const next = existing ? current.map((call) => (call.id === entry.id ? entry : call)) : [entry, ...current];

  return next.slice(0, commandLogLimit);
};
