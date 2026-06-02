import type { CommandOutcome } from "./types";

export type CommandResponse<TResult = unknown> = {
  outcome: CommandOutcome<TResult>;
};

export const unwrapCommandOutcome = <TResult>(
  response: CommandResponse<TResult>,
  fallbackReason = "Command failed.",
) => {
  const { outcome } = response;
  if (outcome.status !== "success") {
    throw new Error(outcome.reason || fallbackReason);
  }

  return outcome.value;
};
