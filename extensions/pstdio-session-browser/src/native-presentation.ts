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
  session?: { status: string; lastRequestStarted: string | null },
) => {
  const [submitted] = await readNativeSubmissions(ctx, id);
  if (
    submitted?.value.state === "pending" &&
    submitted.value.requestStarted === undefined &&
    session &&
    session.lastRequestStarted !== submitted.value.previousRequest
  ) {
    await updateNativeSubmission(ctx, submitted.recordId, { requestStarted: session.lastRequestStarted }, id);
    submitted.value.requestStarted = session.lastRequestStarted;
  }
  const failed =
    submitted?.value.started &&
    submitted.value.state !== "confirmed" &&
    session &&
    ["failed", "disconnected"].includes(session.status) &&
    session.lastRequestStarted === submitted.value.requestStarted;
  const failureNotice = failed
    ? (submitted.body.message ??
      `Native command ${submitted.body.draft.text} ${session.status}. Check the conversation before retrying.`)
    : undefined;
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
    notice:
      failureNotice ??
      (!submitted?.value.started && session?.lastRequestStarted === submitted?.value.previousRequest
        ? (submitted?.body.message ?? "")
        : ""),
    sentTag,
    decisions,
    ...(values && { draftTag: commandDraftTag(values, harnessId, state) }),
    ...(state && { harness: commandSuggestions(state, values && commandIntent(values)) }),
  };
};
