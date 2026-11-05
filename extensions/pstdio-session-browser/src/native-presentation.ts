import type { ControlValueMap, ExtensionContextBase, HarnessCommandState } from "@pstdio/sdk/extensions";
import { commandDraftTag, commandIntent, commandSuggestions } from "./command-intent";
import { decisionSnapshot } from "./harness-confirmation";
import { readNativeSubmissions, updateNativeSubmission } from "./native-submission";
import { submittedInputTag } from "./submit-native";

export const nativePresentation = async (
  ctx: ExtensionContextBase,
  id: string,
  state: HarnessCommandState | undefined,
  harnessId: string,
  values?: ControlValueMap,
) => {
  const [submitted] = await readNativeSubmissions(ctx, id);
  let sentTag = null;
  if (submitted && !submitted.value.hidden) {
    const modeId = commandIntent(submitted.body.draft.values)?.command.composer?.modeId;
    if (modeId && state?.modes.some((mode) => mode.id === modeId))
      await updateNativeSubmission(ctx, submitted.recordId, { hidden: true }, id);
    else sentTag = submittedInputTag(submitted.recordId, submitted.body.draft);
  }
  const decisions = (state?.modes ?? []).flatMap((mode) => {
    const decision = decisionSnapshot(id, mode);
    return decision ? [decision] : [];
  });
  return {
    sentTag,
    decisions,
    ...(values && { draftTag: commandDraftTag(values, harnessId, state) }),
    ...(state && { harness: commandSuggestions(state, values && commandIntent(values)) }),
  };
};
