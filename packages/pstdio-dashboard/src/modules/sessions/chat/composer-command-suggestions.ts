import type { HarnessCommandState } from "pstdio-api-contracts";
import type { ComposerIntent } from "./composer-command";

export const composerCommandSuggestions = (
  state: HarnessCommandState | undefined,
  pending: boolean,
  intent: ComposerIntent | null,
  harnessId: string,
  onSelect: (intent: ComposerIntent) => void,
) => {
  if (!state?.slashCommands || pending) return [];
  return state.commands.map((command) => ({
    ...command,
    disabledReason:
      command.disabledReason ??
      (intent && command.name !== intent.command.name ? `Remove ${intent.command.composer?.label} first.` : undefined),
    ...(command.composer ? { onSelect: () => onSelect({ harnessId, command }) } : {}),
  }));
};
