import type { ControlValueMap, HarnessCommandState } from "@pstdio/sdk/extensions";
import {
  assertSingleCommand,
  type ComposerIntent,
  composerCommandProblem,
  taggedCommandOperation,
} from "./composer-command";

const intentKey = "nativeCommandIntent";
export const commandIntent = (values: ControlValueMap) => {
  const value = values[intentKey];
  if (!value) return undefined;
  if (typeof value !== "string")
    throw new Error("The saved command tag needs recovery. Remove the tag before sending.");
  const intent = JSON.parse(value) as ComposerIntent;
  if (typeof intent.harnessId !== "string" || !intent.command?.name || !intent.command.composer?.label)
    throw new Error("The saved command tag needs recovery. Remove the tag before sending.");
  return intent;
};
export const withCommandIntent = (values: ControlValueMap, intent?: ComposerIntent): ControlValueMap => ({
  ...values,
  [intentKey]: intent ? JSON.stringify(intent) : "",
});
export const commandSuggestions = (state: HarnessCommandState, intent?: ComposerIntent) => ({
  ...state,
  commands: state.slashCommands
    ? state.commands.map((command) => ({
        ...command,
        disabledReason:
          command.disabledReason ??
          (intent && command.name !== intent.command.name
            ? `Remove ${intent.command.composer?.label} first.`
            : undefined),
      }))
    : [],
});
export const operationForDraft = (
  text: string,
  attachments: number,
  values: ControlValueMap,
  harnessId: string,
  state: HarnessCommandState | undefined,
) => {
  const intent = commandIntent(values);
  if (intent) return taggedCommandOperation(intent, text, harnessId, state, attachments);
  if (!/^\/[^\s/]+(?:\s|$)/.test(text)) return undefined;
  if (!state) throw new Error("Native commands are unavailable. Reload the session and try again.");
  if (!state.slashCommands) return undefined;
  if (attachments) throw new Error("Remove attachments before running this command.");
  assertSingleCommand(text, state);
  return { kind: "command" as const, text };
};
export const commandDraftTag = (values: ControlValueMap, harnessId: string, state?: HarnessCommandState) => {
  const intent = commandIntent(values);
  if (!intent) return null;
  return {
    label: intent.command.composer?.label ?? intent.command.name,
    description: composerCommandProblem(intent, harnessId, state) ?? `${intent.command.composer?.label}: Draft input`,
    clearActionId: "clear-command",
  };
};
