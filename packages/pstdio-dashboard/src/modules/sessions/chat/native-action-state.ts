import type { HarnessCommandState, HarnessOperation } from "pstdio-api-contracts";
export const assertCurrentNativeAction = (
  previous: HarnessCommandState["modes"],
  current: HarnessCommandState["modes"],
  operation: Extract<HarnessOperation, { kind: "mode-action" }>,
) => {
  const expected = previous.find((mode) => mode.id === operation.modeId);
  const fresh = current.find((mode) => mode.id === operation.modeId);
  if (
    !expected ||
    !fresh ||
    expected.description !== fresh.description ||
    expected.confirmation?.id !== fresh.confirmation?.id ||
    !fresh.actions.some((action) => action.id === operation.actionId)
  )
    throw new Error("The native mode changed. Review its current details before acting again.");
};
