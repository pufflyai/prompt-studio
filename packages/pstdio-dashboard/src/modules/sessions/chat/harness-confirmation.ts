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
  const id = harnessConfirmationId(input.scope, mode);
  return {
    id,
    pending: input.pending,
    model: confirmation.model,
    actions: [
      { id: "skip", label: "Skip", variant: "ghost" },
      { id: "continue", label: confirmation.cancelLabel ?? "Cancel", variant: "subtle" },
      { id: "approve", label: action.label, variant: "primary", disabled: input.unavailable },
    ],
    onAction: async (actionId) => {
      if (input.pending) throw new Error("A native action is already pending.");
      if (actionId === "skip" || actionId === "continue") {
        input.onDismiss(id);
        return;
      }
      if (actionId !== "approve") throw new Error("Choose one of the available actions.");
      if (input.unavailable) throw new Error("Native status is unavailable. Check it before approving.");
      await input.onAction(mode.id, action.id, confirmation.id, mode);
      input.onDismiss(id);
    },
  } satisfies ComposerDecision;
};
