import type { HarnessCommandState } from "pstdio-api-contracts";
import { useState } from "react";
import {
  createHarnessConfirmation,
  type DismissedHarnessConfirmations,
  nextHarnessConfirmation,
  updateDismissedConfirmations,
} from "../chat/harness-confirmation";

export const useHarnessConfirmation = (
  modes: HarnessCommandState["modes"] | undefined,
  input: Omit<Parameters<typeof createHarnessConfirmation>[1], "onDismiss">,
) => {
  const [dismissed, setDismissed] = useState<DismissedHarnessConfirmations>();
  const mode = nextHarnessConfirmation(modes, input.scope, dismissed);
  return {
    decision: mode
      ? createHarnessConfirmation(mode, {
          ...input,
          onDismiss: (id) => setDismissed((current) => updateDismissedConfirmations(current, input.scope, mode.id, id)),
        })
      : undefined,
    reopen: (modeId: string) => setDismissed((current) => updateDismissedConfirmations(current, input.scope, modeId)),
  };
};
