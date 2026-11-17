import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { WorkbenchExtensionCommandContext } from "./workbench-extension-command";

export const runCommandConfirmation = async (
  context: WorkbenchExtensionCommandContext,
  command: WorkbenchExtensionMetadata["commands"][number],
  params: Record<string, unknown> | undefined,
  persist: () => Promise<unknown>,
  resourceLabel?: string,
  signal?: AbortSignal,
) => {
  const options = command.confirmation;
  const title = text(command.title, "Delete");
  const subject = options?.subjectParam ? params?.[options.subjectParam] : resourceLabel;
  let saved: Promise<unknown> | undefined;
  const confirmed = await context.workbench.commandPalette.requestConfirmation(
    typeof subject === "string" && subject ? `${title}: ${subject}` : title,
    {
      signal,
      description: text(options?.description ?? command.description),
      buttonLabel: options ? text(options.buttonLabel, "Delete") : title,
      onConfirm: async () => {
        saved = persist();
        await saved;
      },
    },
  );
  // UI confirmation saves before closing, so errors remain in the host dialog for retry.
  return confirmed && !signal?.aborted ? (saved ?? persist()) : undefined;
};
