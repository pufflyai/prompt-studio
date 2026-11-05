import type { ChatDraft, ChatRendererAction, ExtensionContextBase, ResourceRef } from "@pstdio/sdk/extensions";
import { sessionBrowser } from "../refs";
import { commandIntent, operationForDraft, withCommandIntent } from "./command-intent";
import { readNativeState } from "./native-actions";
import { saveNativeSubmission } from "./native-submission";
import { sessionResource } from "./resource";
import { selectedHarness, selectedWorkspace } from "./selection";

export const submittedInputTag = (recordId: string, draft: ChatDraft) => {
  const intent = commandIntent(draft.values);
  if (!intent) return null;
  const label = intent.command.composer?.label ?? intent.command.name;
  return {
    label,
    description: `${draft.text.trim()} · Native status is not confirmed. Closing hides this reference only.`,
    clearActionId: `hide-native:${recordId}`,
    closeLabel: `Hide submitted ${label.toLowerCase()}`,
  };
};
export const submitNativeDraft = async (
  ctx: ExtensionContextBase,
  id: string | undefined,
  resource: ResourceRef | undefined,
  action: ChatRendererAction,
) => {
  if (action.type !== "submit" || action.questionResponse) return undefined;
  const intent = commandIntent(action.values);
  if (!intent && !/^\/[^\s/]+(?:\s|$)/.test(action.text)) return undefined;
  if (/^\/(?:login|logout)(?:\s|$)/.test(action.text))
    throw new Error("Use the harness account control to sign in or out.");
  const state = await readNativeState(ctx, id, action.values);
  const operation = operationForDraft(action.text, action.attachments.length, action.values, state.harnessId, state);
  if (!operation) return undefined;
  const previous = id ? await ctx.sessions.get(id) : null;
  const created = id
    ? undefined
    : await ctx.sessions.create({
        title: action.text.slice(0, 100) || "Session",
        operation,
        harness: selectedHarness(action.values),
        workspaceId: selectedWorkspace(action.values),
        deviceId: typeof action.values.device === "string" && action.values.device ? action.values.device : undefined,
      });
  const target = id ?? created!.id;
  const result = id
    ? await ctx.sessions.invokeHarnessOperation(id, operation, state.harnessId)
    : created!.operationResult;
  if (!result)
    throw new Error("The host did not acknowledge the native operation. Check the conversation before retrying.");
  const draft = { text: action.text, attachments: action.attachments, values: action.values };
  const recordId = await saveNativeSubmission(
    ctx,
    target,
    { draft, operation, message: result.message },
    previous?.lastRequestStarted ?? null,
    result.status === "started",
  );
  if (created)
    ctx.navigation.open({
      kind: "viewer",
      operation: "replace",
      from: resource,
      resource: sessionResource(created, ctx.projectId),
      page: sessionBrowser.pages.session,
    });
  return {
    snapshot: {
      values: withCommandIntent({}),
      draftTag: null,
      sentTag: submittedInputTag(recordId, draft),
      notice: result.message ?? "",
    },
  };
};
