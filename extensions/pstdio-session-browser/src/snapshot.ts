import type { ChatRendererSnapshot, ControlValueMap, ExtensionContextBase, ResourceRef } from "@pstdio/sdk/extensions";
import { composerControls, conversationOperations } from "./controls";
import { conversationState } from "./conversation-state";
import { draftSnapshot } from "./draft-snapshot";
import { readDraft } from "./drafts";
import { nativePresentation } from "./native-presentation";
import { readQueue } from "./queue-snapshot";
import { sessionId } from "./resource";
import { savedWorkspaceControls, workspacePresentation } from "./workspace";

export { composerControls } from "./controls";

const executionNotice = (
  execution: Awaited<ReturnType<ExtensionContextBase["sessions"]["getExecutionState"]>>,
  error?: string,
) => {
  if (execution.kind === "remote" && !execution.available)
    return `${execution.device?.name ?? "This device"} is offline. Reconnect it before sending.`;
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
  // Own every started read immediately: an availability wait may abort before the
  // queue result is needed, and its parallel rejection must still be observed.
  const [execution, queued] = await Promise.all([
    ctx.sessions.getExecutionState(id),
    options.queue ?? readQueue(ctx, id),
  ]);
  const remote = execution.kind === "remote";
  const readConversation = async () => {
    if (!remote && options.messages !== false) return ctx.sessions.getConversation(id);
    const session = await ctx.sessions.get(id);
    if (!session) throw new Error("Session not found.");
    // Remote history is the public checkpoint; queue/device availability must not gate reading it.
    const sources = remote && options.messages !== false ? await ctx.sessions.getConversationSources(id) : undefined;
    return { session, messages: sources?.checkpoint ?? [] };
  };
  const [{ session, messages }, harness] = await Promise.all([
    readConversation(),
    remote ? undefined : ctx.sessions.getHarnessCommands(id),
  ]);
  const workspaceId = session.workspaceId ?? undefined;
  const workspaces = await ctx.workspaces.list();
  const workspaceInfo = workspaces.find((workspace) => workspace.id === workspaceId);
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
    workspace: await workspacePresentation(ctx, workspaceInfo, {
      id: workspaceId,
      existingSession: true,
      available: execution.available,
    }),
    controls: [...savedControls, ...savedWorkspaceControls(workspaceId, workspaceInfo, session.device)],
    harness,
    streaming: ["in_progress", "awaiting_input"].includes(session.status),
    ...(session.lastRequestStarted ? { streamingStartedAt: new Date(session.lastRequestStarted).getTime() } : {}),
    readOnly: !execution.available,
    queueReadOnly: display.queueReadOnly,
    queueSteeringUnavailableReason: display.queueSteeringUnavailableReason,
    notice,
    values: {
      harness: {
        harnessId: session.agent ?? "",
        ...(session.lastSelectedModel ? { model: session.lastSelectedModel } : {}),
        params: session.params ?? {},
      },
      workspace: workspaceId ?? "",
      device: session.device?.id ?? "",
      ...values,
    },
    fork: remote ? undefined : { disabledReason: null },
    resources: [],
    operations: conversationOperations(remote, Boolean(display.queueReadOnly)),
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
