import type { HarnessCommandState } from "@pstdio/sdk/extensions";

export const harnessConfirmationId = (scope: string, mode: HarnessCommandState["modes"][number]) =>
  JSON.stringify([scope, mode.id, mode.confirmation?.id]);

/** Domain presentation only: the native view owner manages transient revision dismissal. */
export const decisionSnapshot = (scope: string, mode?: HarnessCommandState["modes"][number]) => {
  const confirmation = mode?.confirmation;
  const action = mode?.actions.find((action) => action.id === confirmation?.actionId);
  if (!mode || !confirmation || !action) return null;
  return {
    id: harnessConfirmationId(scope, mode),
    model: confirmation.model,
    modeSnapshot: mode,
    actions: [
      { id: "skip", label: "Skip", variant: "ghost" as const },
      { id: "continue", label: confirmation.cancelLabel ?? "Cancel", variant: "subtle" as const },
      { id: "approve", label: action.label, variant: "primary" as const },
    ],
  };
};
