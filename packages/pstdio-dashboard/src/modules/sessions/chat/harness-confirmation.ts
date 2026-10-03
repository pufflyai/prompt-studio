import type { ComposerDecision, HarnessControlsProps } from "@pstdio/ui/chat-ui";
import type { HarnessCommandState } from "pstdio-api-contracts";

interface HarnessConfirmationInput {
  scope: string;
  pending?: boolean;
  unavailable?: boolean;
  onAction: HarnessControlsProps["onAction"];
  onDismiss: (id: string) => void;
}

export const harnessConfirmationId = (scope: string, mode: HarnessCommandState["modes"][number]) =>
  JSON.stringify([scope, mode.id, mode.confirmation?.id]);

export interface DismissedHarnessConfirmations {
  scope: string;
  byMode: Record<string, string>;
}

export const updateDismissedConfirmations = (
  current: DismissedHarnessConfirmations | undefined,
  scope: string,
  modeId: string,
  confirmationId?: string,
) => {
  const byMode = current?.scope === scope ? { ...current.byMode } : {};
  if (confirmationId) byMode[modeId] = confirmationId;
  else delete byMode[modeId];
  return { scope, byMode };
};

export const nextHarnessConfirmation = (
  modes: HarnessCommandState["modes"] | undefined,
  scope: string,
  dismissed: DismissedHarnessConfirmations | undefined,
) =>
  modes?.find(
    (mode) =>
      mode.confirmation &&
      mode.actions.some((action) => action.id === mode.confirmation?.actionId) &&
      (dismissed?.scope !== scope || dismissed.byMode[mode.id] !== harnessConfirmationId(scope, mode)),
  );

export const createHarnessConfirmation = (
  mode: HarnessCommandState["modes"][number],
  input: HarnessConfirmationInput,
) => {
  const confirmation = mode.confirmation;
  const action = mode.actions.find((action) => action.id === confirmation?.actionId);
  if (!confirmation || !action) return undefined;
  const callId = harnessConfirmationId(input.scope, mode);
  const cancel = confirmation.cancelLabel ?? "Cancel";
  return {
    prompt: {
      callId,
      questions: [
        {
          id: callId,
          question: confirmation.title,
          required: true,
          allowCustomAnswer: false,
          options: [{ label: action.label }, { label: cancel }],
        },
      ],
    },
    pending: input.pending,
    canRespond: (response) => response.answers[0]?.[0] === cancel || (!input.pending && !input.unavailable),
    onRespond: async (response) => {
      if (response.callId !== callId) throw new Error("The plan changed. Review the current plan before approving.");
      const answer = response.answers[0]?.[0];
      if (!response.answers.length || answer === cancel) {
        input.onDismiss(callId);
        return;
      }
      if (answer !== action.label || response.answers.length !== 1 || response.answers[0].length !== 1)
        throw new Error("Choose one of the available actions.");
      if (input.pending || input.unavailable)
        throw new Error("Native status is unavailable. Check it before approving.");
      await input.onAction(mode.id, action.id, confirmation.id, mode);
      input.onDismiss(callId);
    },
  } satisfies ComposerDecision;
};
