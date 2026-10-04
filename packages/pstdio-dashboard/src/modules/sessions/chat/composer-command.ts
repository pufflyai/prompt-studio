import type { HarnessCommandState } from "pstdio-api-contracts";

export interface ComposerIntent {
  harnessId: string;
  command: HarnessCommandState["commands"][number];
}
export const assertSingleCommand = (text: string, state: HarnessCommandState) => {
  const name = /^\/\S+/.exec(text)?.[0];
  const command = state.commands.find((entry) => entry.name === name);
  if (command?.disabledReason) throw new Error(command.disabledReason);
  const second = /^\/\S+\s+(\/\S+)(?:\s|$)/.exec(text)?.[1];
  if (state.commands.some((command) => command.name === second))
    throw new Error("Submit one native command at a time. This harness has not declared command composition.");
};
export const composerCommandProblem = (intent: ComposerIntent, harnessId: string, state?: HarnessCommandState) => {
  if (intent.harnessId !== harnessId) return `Remove ${intent.command.composer?.label} or return to its harness.`;
  const command = state?.commands.find((entry) => entry.name === intent.command.name);
  if (!state?.slashCommands || !command?.composer)
    return "This tagged input is unavailable. Check the harness or remove the tag.";
  return command.disabledReason;
};
export const taggedCommandOperation = (
  intent: ComposerIntent,
  text: string,
  harnessId: string,
  state: HarnessCommandState | undefined,
  attachments: number,
) => {
  const problem = composerCommandProblem(intent, harnessId, state);
  if (problem) throw new Error(problem);
  if (attachments) throw new Error("Remove attachments before submitting tagged native input.");
  const objective = text.trim();
  if (!objective) throw new Error("Enter an objective before submitting this tag.");
  const command = state?.commands.find((entry) => entry.name === intent.command.name);
  if (command?.composer?.reservedArguments?.includes(objective))
    throw new Error("This text is a native action. Use the native controls or enter an objective.");
  return { kind: "command" as const, text: `${intent.command.name} ${objective}` };
};
