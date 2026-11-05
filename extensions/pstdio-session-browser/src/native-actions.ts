import type { ChatRendererAction, ControlValueMap, ExtensionContextBase } from "@pstdio/sdk/extensions";
import { commandDraftTag, commandIntent, withCommandIntent } from "./command-intent";
import { decisionSnapshot, harnessConfirmationId } from "./harness-confirmation";
import { assertCurrentNativeAction } from "./native-action-state";
import { updateNativeSubmission } from "./native-submission";
import { selectedHarness, selectedWorkspace } from "./selection";

export const readNativeState = async (ctx: ExtensionContextBase, id: string | undefined, values: ControlValueMap) => {
  const harness = selectedHarness(values);
  if (!harness) throw new Error("Select a harness before using native controls.");
  const state = id
    ? await ctx.sessions.getHarnessCommands(id)
    : await ctx.sessions.getDraftHarnessCommands({ harness, workspaceId: selectedWorkspace(values) });
  if (state.harnessId !== harness.harnessId)
    throw new Error("The harness changed. Review its current controls before acting.");
  return state;
};
const selectNativeCommand = async (
  ctx: ExtensionContextBase,
  id: string | undefined,
  action: Extract<ChatRendererAction, { type: "selectCommand" }>,
) => {
  const values = action.values ?? {};
  const state = await readNativeState(ctx, id, values);
  const command = state.commands.find((item) => item.name === action.name);
  if (!state.slashCommands || !command?.composer)
    throw new Error("This tagged command is unavailable. Refresh its controls.");
  if (command.disabledReason) throw new Error(command.disabledReason);
  const previous = commandIntent(values);
  if (previous && previous.command.name !== command.name)
    throw new Error(`Remove ${previous.command.composer?.label} first.`);
  const updated = withCommandIntent({}, { harnessId: state.harnessId, command });
  return { snapshot: { values: updated, draftTag: commandDraftTag(updated, state.harnessId, state) } };
};
const invokeNativeAction = async (
  ctx: ExtensionContextBase,
  id: string | undefined,
  action: Extract<ChatRendererAction, { type: "confirmation" | "decision" | "harness" }>,
) => {
  const scope = id ?? "draft";
  if (action.type === "decision" && (action.actionId === "skip" || action.actionId === "continue"))
    return { snapshot: { decision: null } };
  const state = await readNativeState(ctx, id, action.values ?? {});
  if (action.type === "confirmation") {
    const mode = state.modes.find((item) => item.id === action.modeId);
    const decision = decisionSnapshot(scope, mode);
    if (!decision) throw new Error("This native decision changed. Refresh before confirming.");
    return { snapshot: { decision } };
  }
  let operation = action.type === "harness" ? action.operation : undefined;
  if (action.type === "decision") {
    const mode = action.modeSnapshot;
    if (action.actionId !== "approve" || !mode?.confirmation || harnessConfirmationId(scope, mode) !== action.id)
      throw new Error("This native decision changed. Review its current details before acting.");
    operation = {
      kind: "mode-action",
      modeId: mode.id,
      actionId: mode.confirmation.actionId,
      argument: mode.confirmation.id,
    };
  }
  if (!operation) throw new Error("Choose one of the available native actions.");
  if (operation.kind === "mode-action")
    assertCurrentNativeAction(action.modeSnapshot ? [action.modeSnapshot] : [], state.modes, operation);
  if (!id) throw new Error("Start a conversation before changing an existing native mode.");
  const result = await ctx.sessions.invokeHarnessOperation(id, operation, state.harnessId);
  return { snapshot: { decision: null, notice: result.message ?? "" } };
};
export const nativeAction = async (ctx: ExtensionContextBase, id: string | undefined, action: ChatRendererAction) => {
  if (action.type === "operation" && action.id.startsWith("hide-native:")) {
    if (!id) throw new Error("This submitted input does not belong to this conversation.");
    await updateNativeSubmission(ctx, action.id.slice("hide-native:".length), { hidden: true }, id);
    return { snapshot: { sentTag: null } };
  }
  if (action.type === "operation" && action.id === "clear-command")
    return { snapshot: { draftTag: null, values: withCommandIntent({}) } };
  if (action.type === "selectCommand") return selectNativeCommand(ctx, id, action);
  if (action.type !== "confirmation" && action.type !== "decision" && action.type !== "harness") return undefined;
  return invokeNativeAction(ctx, id, action);
};
