import type { CommandOutcome } from "pstdio-api-contracts/extension-kernel";

export type CommandResponse<TResult = unknown> = {
  outcome: CommandOutcome<TResult>;
};

export class CommandOutcomeError extends Error {
  readonly code;
  readonly outcome;
  constructor(outcome: Extract<CommandOutcome, { ok: false }>) {
    super(outcome.reason || outcome.error?.message || "Command failed.", { cause: outcome.cause });
    this.name = "CommandOutcomeError";
    this.code = outcome.code;
    this.outcome = outcome;
  }
}

export const getCommandValue = <TResult>(outcome: CommandOutcome<TResult>) => {
  if (!outcome.ok) throw new CommandOutcomeError(outcome);
  return outcome.value;
};

/** @deprecated Use getCommandValue; its CommandOutcomeError retains the complete outcome. */
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
