import type { ChatRendererSnapshot, ControlValueMap, ExtensionContextBase, ResourceRef } from "@pstdio/sdk/extensions";
import { composerControls } from "./controls";
import { conversationState } from "./conversation-state";
import { draftSnapshot } from "./draft-snapshot";
import { readDraft } from "./drafts";
import { nativePresentation } from "./native-presentation";
import { readQueue } from "./queue-snapshot";
import { sessionId } from "./resource";

export { composerControls } from "./controls";

const executionNotice = (
  execution: Awaited<ReturnType<ExtensionContextBase["sessions"]["getExecutionState"]>>,
  error?: string,
) => {
  if (execution.kind === "remote" && !execution.available)
    return `${execution.device?.name ?? "This device"} is offline. Reconnect it before sending.`;
  if (execution.kind === "remote" && !error) return `Working on ${execution.device?.name}.`;
  return error ?? "";
};
type SnapshotOptions = { messages?: boolean; queue?: ReturnType<typeof readQueue> };
export const readSnapshot = async (
  ctx: ExtensionContextBase,
  resource?: ResourceRef,
  values?: ControlValueMap,
  options: SnapshotOptions = {},
): Promise<ChatRendererSnapshot> => {
  const id = sessionId(resource);
  return id ? (await readSessionSnapshot(ctx, id, values, options)).snapshot : draftSnapshot(ctx, resource, values);
};
export const readSessionSnapshot = async (
  ctx: ExtensionContextBase,
  id: string,
  values?: ControlValueMap,
  options: SnapshotOptions = {},
) => {
  const execution = await ctx.sessions.getExecutionState(id);
  const remote = execution.kind === "remote";
  const readConversation = async () => {
    if (!remote && options.messages !== false) return ctx.sessions.getConversation(id);
    const session = await ctx.sessions.get(id);
    if (!session) throw new Error("Session not found.");
    // Remote history is the public checkpoint; queue/device availability must not gate reading it.
    const sources = remote && options.messages !== false ? await ctx.sessions.getConversationSources(id) : undefined;
    return { session, messages: sources?.checkpoint ?? [] };
  };
  const [{ session, messages }, queued, harness, fork] = await Promise.all([
    readConversation(),
    options.queue ?? readQueue(ctx, id),
    remote ? undefined : ctx.sessions.getHarnessCommands(id),
    remote ? { supported: false, disabledReason: null } : ctx.sessions.getForkState(id, { scope: "reply" }),
  ]);
  const workspaceId = session.workspaceId ?? undefined;
  const savedControls = composerControls.map((control) =>
    control.type === "harness" ? { ...control, lockIdentity: Boolean(session.agent), readOnly: remote } : control,
  );
  const display = conversationState(
    id,
    [...messages.filter((message) => !message.id.startsWith(`queued-prompt-${id}-`)), ...queued.messages],
    queued.queue,
    session.agent,
    remote,
  );
  const notice = executionNotice(execution, queued.error);
  const snapshot: ChatRendererSnapshot = {
    nativeLinks: true,
    nativeHarnessAccount: { controlId: "harness", remote },
    workspaceId,
    controls: savedControls.filter((control) => control.id !== "workspace"),
    harness,
    streaming: ["in_progress", "awaiting_input"].includes(session.status),
    ...(session.lastRequestStarted ? { streamingStartedAt: new Date(session.lastRequestStarted).getTime() } : {}),
    readOnly: !execution.available,
    queueReadOnly: display.queueReadOnly,
    notice,
    values: {
      harness: {
        harnessId: session.agent ?? "",
        ...(session.lastSelectedModel ? { model: session.lastSelectedModel } : {}),
        params: session.params ?? {},
      },
      workspace: workspaceId ?? "",
      ...values,
    },
    fork: fork.supported ? { disabledReason: fork.disabledReason } : undefined,
    resources: workspaceId ? [{ id: workspaceId, label: "Open workspace" }] : [],
    operations: display.queueReadOnly ? [{ id: "refresh-queue", label: "Refresh queue" }] : [],
  };
  const draftValues = values ?? (options.messages === false ? undefined : (await readDraft(ctx, id)).values);
  const { notice: nativeNotice, ...native } = await nativePresentation(
    ctx,
    id,
    harness,
    session.agent ?? "",
    draftValues,
    session,
  );
  Object.assign(snapshot, native);
  // Queue/device feedback has priority; an explicit empty notice retires earlier native failures.
  snapshot.notice = notice || nativeNotice;
  if (!queued.error) snapshot.queuedFollowUps = display.queuedFollowUps;
  if (options.messages !== false) snapshot.messages = display.messages;
  return { snapshot, session };
};
