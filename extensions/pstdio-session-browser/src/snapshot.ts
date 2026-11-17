import type { ChatRendererSnapshot, ControlValueMap, ExtensionContextBase, ResourceRef } from "@pstdio/sdk/extensions";
import { composerControls, conversationOperations } from "./controls";
import { conversationState } from "./conversation-state";
import { draftSnapshot } from "./draft-snapshot";
import { nativePresentation } from "./native-presentation";
import { sessionId } from "./resource";
import { readSnapshotInputs, readSnapshotWorkspace, type SnapshotOptions, type SnapshotReads } from "./snapshot-reads";
import { savedWorkspaceControls, withWorkspaceControls } from "./workspace";

export { composerControls } from "./controls";

export const executionNotice = (
  execution: Awaited<ReturnType<ExtensionContextBase["sessions"]["getExecutionState"]>>,
  error?: string,
) => {
  if (execution.kind === "remote" && !execution.available)
    return `${execution.device?.name ?? "This device"} is offline. Reconnect it before sending.`;
  return error ?? "";
};
export const readSnapshot = async (
  ctx: ExtensionContextBase,
  resource?: ResourceRef,
  values?: ControlValueMap,
  options: SnapshotOptions = {},
): Promise<ChatRendererSnapshot> => {
  const id = sessionId(resource);
  return id ? (await readSessionSnapshot(ctx, id, values, options)).snapshot : draftSnapshot(ctx, resource, values);
};
const sessionComposerControls = (session: SnapshotReads["session"], remote: boolean) =>
  composerControls.map((control) =>
    control.type === "harness" ? { ...control, lockIdentity: Boolean(session.agent), readOnly: remote } : control,
  );
export const readSessionSnapshot = async (
  ctx: ExtensionContextBase,
  id: string,
  values?: ControlValueMap,
  options: SnapshotOptions = {},
) => {
  const { sessionRead, executionRead, queueRead, messages, reads } = await readSnapshotInputs(ctx, id, options);
  const { session, execution, queued, harness, workspace: workspaceInfo } = reads;
  const remote = execution.kind === "remote";
  const workspaceId = session.workspaceId ?? undefined;
  const savedControls = sessionComposerControls(session, remote);
  const display = conversationState(
    id,
    [...messages.filter((message) => !message.id.startsWith(`queued-prompt-${id}-`)), ...queued.messages],
    queued.queue,
    session.agent,
    remote,
  );
  const notice = executionNotice(execution, queued.error);
  const workspacePresentation = await readSnapshotWorkspace(ctx, reads, options, sessionRead || executionRead);
  const snapshot: ChatRendererSnapshot = {
    nativeLinks: true,
    nativeHarnessAccount: { controlId: "harness", remote },
    workspaceId,
    ...withWorkspaceControls(
      [...savedControls, ...savedWorkspaceControls(workspaceId, workspaceInfo, session.device)],
      workspacePresentation,
    ),
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
  const nativeRead = sessionRead || options.changes?.has("harness") || options.changes?.has("storage");
  const nativeProjection =
    !nativeRead && options.previous?.native
      ? options.previous.native
      : await nativePresentation(ctx, id, harness, session.agent ?? "", values, session);
  const { notice: nativeNotice, ...native } = nativeProjection;
  Object.assign(snapshot, native);
  // Queue/device feedback has priority; an explicit empty notice retires earlier native failures.
  snapshot.notice = notice || nativeNotice;
  if (!queued.error) snapshot.queuedFollowUps = display.queuedFollowUps;
  if (options.messages !== false) snapshot.messages = display.messages;
  return {
    snapshot,
    session,
    reads: { ...reads, workspacePresentation, native: nativeProjection } satisfies SnapshotReads,
    sessionRead,
    queueRead,
    nativeNotice,
  };
};
