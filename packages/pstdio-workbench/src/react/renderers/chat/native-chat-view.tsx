import { Box } from "@chakra-ui/react";
import type { ChatAttachment, ChatQueuedRequest, ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import { type ChatLinkHandler, ChatPanel } from "@pstdio/ui/chat-ui";
import { type ComponentProps, type ComponentType, useCallback, useState, useSyncExternalStore } from "react";
import { visibleChatDraftAttachments } from "../../../extensions/contributions/chat-pending-submission";
import type { ChatSession } from "../../../extensions/contributions/chat-session";
import type { CommandParamFieldRenderer } from "../../command-palette/command-param-field";
import { nativeChatInputHandler, submitWithNativeChatAccount } from "./native-chat-account-submit";
import { runNativeChatAction } from "./native-chat-action";
import {
  NativeChatAttachmentActions,
  NativeChatAttachmentList,
  nativeChatTextAttachment,
  uploadNativeChatAttachments,
} from "./native-chat-attachments";
import {
  NativeChatControls,
  NativeChatHarnessControls,
  nativeChatApproval,
  nativeChatCommands,
  nativeChatDecision,
} from "./native-chat-controls";
import type { NativeChatHostProps, NativeChatHostServices } from "./native-chat-host";
import { findQueuedChatRequest, projectQueuedFollowUps, queuedChatDraft } from "./native-chat-queue";
import { NativeChatComposerHeader, NativeChatNotices } from "./native-chat-status";
import { NativeChatWorkspace } from "./native-chat-workspace";
import { useNativeChatActions } from "./use-native-chat-actions";
import { useNativeChatObservation } from "./use-native-chat-observation";
import { type NativeChatPresentation, useNativeChatPresentation } from "./use-native-chat-presentation";

interface NativeChatViewProps extends NativeChatHostServices {
  workbench?: import("../../../core").WorkbenchModuleContext;
  resource?: import("@pstdio/sdk/extensions").ResourceRef;
  Host?: ComponentType<NativeChatHostProps>;
  extensionId?: string;
  session: ChatSession;
  action: Parameters<ChatSession["run"]>[1];
  linkHandler?: ChatLinkHandler;
  sourceRegion?: NativeChatHostProps["sourceRegion"];
  conversationKey: string;
  observe?: (session: ChatSession) => () => void;
  resolve?: () => NativeChatPresentation | undefined;
  /** Hidden retained presentations must not request composer focus. */
  visible?: boolean;
  placementOpen?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  renderParamField?: CommandParamFieldRenderer;
}

interface NativeChatComposerAvailability {
  conversation: ChatRendererSnapshot;
  account?: NativeChatHostServices["account"];
  text: string;
  sending: boolean;
  uploading: boolean;
  editingQueue: boolean;
  unresolved: boolean;
}

const nativeChatComposerAvailability = (props: NativeChatComposerAvailability) => {
  const { conversation, account, text, sending, uploading, editingQueue, unresolved } = props;
  const composerRequestsDisabled = Boolean(conversation.readOnly || account?.progress || unresolved);
  const inputDisabled = sending || uploading;
  return {
    inputDisabled,
    composerRequestsDisabled,
    showAgentQuestionAlongsideDraft: Boolean(
      account?.progress && !conversation.readOnly && !editingQueue && !conversation.approval,
    ),
    agentQuestionSubmitDisabled: Boolean(account?.blocked || account?.progress),
    submitDisabled:
      composerRequestsDisabled ||
      conversation.submitDisabled ||
      (editingQueue && conversation.queueReadOnly) ||
      inputDisabled ||
      Boolean(account?.blocked && !account.isCommand(text)),
  };
};

const nativeChatAttachmentHandlers = (readOnly: boolean | undefined, upload: (files: File[]) => Promise<void>) =>
  readOnly
    ? {}
    : {
        onAttachFiles: (files: File[]) => void upload(files).catch(() => undefined),
        onAttachText: nativeChatTextAttachment(upload),
      };

const PassthroughChatHost = ({ children }: NativeChatHostProps) => children({});

export const NativeChatView = (props: NativeChatViewProps) => (
  <Box position="relative" h="full" minH="0" minW="0" overflow="hidden">
    {/* Chat owns its viewport; transcript height must not grow the outer region. */}
    <Box position="absolute" inset="0" minH="0" minW="0" overflow="hidden">
      <NativeChatContent {...props} />
    </Box>
  </Box>
);

const NativeChatContent = (props: NativeChatViewProps) => {
  const open = props.placementOpen !== false;
  const [transcript, setTranscript] = useState({ open, revision: 0 });
  if (transcript.open !== open) {
    // Closed placements may keep their React state. Reopen with a fresh viewport.
    setTranscript({ open, revision: transcript.revision + Number(open) });
  }
  const { key, ...presentation } = useNativeChatPresentation({
    initial: {
      session: props.session,
      action: props.action,
      linkHandler: props.linkHandler,
      key: props.conversationKey,
    },
    resolve: props.resolve,
    observe: props.observe,
    visible: props.visible,
  });
  const unresolved = useUnresolvedSubmission(presentation.session);
  return (
    <NativeChatConversation
      key={key}
      {...props}
      {...presentation}
      conversationKey={key}
      transcriptRevision={transcript.revision}
      unresolved={unresolved}
    />
  );
};

const useUnresolvedSubmission = (session: ChatSession) => {
  const subscribe = useCallback(
    (changed: () => void) => {
      const stopSubmissions = session.subscribeSubmissions(changed);
      const stopView = session.subscribeToView(changed);
      return () => {
        stopSubmissions();
        stopView();
      };
    },
    [session],
  );
  return useSyncExternalStore(subscribe, session.hasUnresolvedSubmission, session.hasUnresolvedSubmission);
};

const runQueueGesture = (work: () => Promise<unknown>, report: (error: unknown) => void) =>
  void Promise.resolve().then(work).catch(report);

const NativeChatConversation = (props: NativeChatViewProps & { transcriptRevision: number; unresolved: boolean }) => {
  const { session, conversationKey, renderParamField, unresolved } = props;
  const state = useSyncExternalStore(session.subscribeToView, session.getSnapshot, session.getSnapshot);
  const { conversation: confirmed, draft, messages, queuedFollowUps, pending, loading, initializing, sending } = state;
  const observation = useNativeChatObservation(props, state);
  const pendingActions = useNativeChatActions(session, confirmed);
  const conversation = pendingActions.queue ? { ...confirmed, queueReadOnly: true } : confirmed;
  const run: ChatSession["run"] = (action) => runNativeChatAction(session, action, props.action, Boolean(selected));
  const [uploading, setUploading] = useState(0);
  const [selected, setSelected] = useState<ChatQueuedRequest | null>(null);
  const [edits, setEdits] = useState<Record<string, { values: typeof draft.values; attachments: ChatAttachment[] }>>(
    {},
  );
  const activeDraft = selected && edits[selected.id] ? { ...draft, ...edits[selected.id] } : draft;
  const values = activeDraft.values;
  const attachments = visibleChatDraftAttachments(activeDraft.attachments, selected ? undefined : pending);
  const changeActive = (update: Partial<typeof activeDraft>) => {
    if (selected) setEdits((current) => ({ ...current, [selected.id]: { values, attachments, ...update } }));
    else session.changeDraft(update);
  };
  const upload = async (files: File[]) => {
    setUploading((count) => count + files.length);
    const target = selected?.id;
    try {
      await uploadNativeChatAttachments(files, run, (attachment) => {
        if (target)
          setEdits((current) => {
            const currentDraft = current[target] ?? { values, attachments: [] };
            return {
              ...current,
              [target]: { ...currentDraft, attachments: [...currentDraft.attachments, attachment] },
            };
          });
        else session.changeDraft({ attachments: [...session.getSnapshot().draft.attachments, attachment] });
      });
    } catch (error) {
      session.reportError(error);
    } finally {
      setUploading((count) => count - files.length);
    }
  };
  const queue = (
    operation: "update" | "create" | "remove" | "move" | "combine" | "steer",
    item: ChatQueuedRequest,
    extra: { prompt?: string; direction?: "up" | "down"; steps?: number; target?: ChatQueuedRequest } = {},
  ) => run({ type: "queue", operation, item, ...extra, values, attachments }).then(() => undefined);
  const find = (id: string) => findQueuedChatRequest(conversation.queuedFollowUps, id);
  const forkMessage = conversation.fork
    ? (messageId: string) => run({ type: "fork", messageId }).then(() => undefined)
    : undefined;
  const Host = props.Host ?? PassthroughChatHost;
  const approval = nativeChatApproval(conversation, run, session.reportError);
  const interrupt =
    conversation.streaming && !conversation.readOnly && !pendingActions.stop
      ? () => void run({ type: "stop" }).catch(() => undefined)
      : undefined;
  return (
    <Host
      session={session}
      values={values}
      attachments={attachments}
      extensionId={props.extensionId}
      linkHandler={props.linkHandler}
      sourceRegion={props.sourceRegion}
    >
      {(host) => {
        const availability = nativeChatComposerAvailability({
          conversation,
          account: host.account,
          text: draft.text,
          sending,
          unresolved,
          uploading: uploading > 0,
          editingQueue: Boolean(selected),
        });
        const controlProps = {
          run,
          reconnect: session.reconnect,
          conversation,
          draft: activeDraft,
          editingQueuedRequest: Boolean(selected),
          unavailable: host.account?.blocked,
          initializing,
          renderParamField,
          changeValues: (next) => changeActive({ values: next }),
        } satisfies ComponentProps<typeof NativeChatControls>;
        return (
          <ChatPanel
            conversationKey={conversationKey}
            transcriptRevision={props.transcriptRevision}
            onVisibleMessageIdsChange={observation.onVisibleMessageIdsChange}
            onVisibleQuestionChange={observation.onVisibleQuestionChange}
            linkHandler={host.linkHandler ?? props.linkHandler}
            messages={host.messages ?? messages}
            historyMessages={state.historyMessages}
            onForkMessage={forkMessage}
            forkDisabledReason={
              conversation.fork?.disabledReason ??
              (conversation.readOnly ? "This conversation is read only." : undefined)
            }
            loading={loading}
            emptyStateContent={host.account?.setup ?? host.account?.progress}
            emptyStateTitle={props.emptyTitle ?? "No messages yet"}
            emptyStateDescription={props.emptyDescription ?? "Send a message to start this session."}
            chatInputPlaceholder="Reply to the agent..."
            chatInputAutoFocus={props.visible !== false}
            chatInputDefaultValue={draft.text}
            onChatInputChange={(text) => session.changeDraft({ text })}
            streaming={conversation.streaming}
            streamingStartedAt={conversation.streamingStartedAt}
            {...availability}
            readOnlyQueue={conversation.readOnly || conversation.queueReadOnly}
            agentQuestionSubmitDisabled={availability.agentQuestionSubmitDisabled || Boolean(pendingActions.approval)}
            queueSteeringUnavailableReason={conversation.queueSteeringUnavailableReason}
            onSubmitMessage={(text, files, questionResponse) =>
              approval && questionResponse && questionResponse.callId === approval.prompt.callId
                ? approval.answer(questionResponse)
                : nativeChatInputHandler({ account: host.account, session, run, draft: { attachments, values } })(
                    text,
                    files,
                    questionResponse,
                  )
            }
            onInterrupt={interrupt}
            chatInputQuestionPrompt={approval?.prompt}
            chatInputCommands={
              availability.composerRequestsDisabled ? [] : nativeChatCommands(conversation, host.account, run, values)
            }
            composerDecision={nativeChatDecision(
              conversation,
              <NativeChatHarnessControls {...controlProps} />,
              run,
              values,
              sending,
            )}
            workspaceHub={
              <NativeChatWorkspace
                conversation={conversation}
                draft={activeDraft}
                initializing={initializing || Boolean(selected)}
                run={run}
                changeValues={(next) =>
                  changeActive({ values: typeof next === "function" ? next(session.getSnapshot().draft.values) : next })
                }
              />
            }
            actions={<NativeChatControls {...controlProps} />}
            composerHeader={<NativeChatComposerHeader state={state} session={session} pending={pendingActions} />}
            conversationNotices={<NativeChatNotices host={host} state={state} session={session} />}
            {...nativeChatAttachmentHandlers(conversation.readOnly, upload)}
            attachmentActions={
              <NativeChatAttachmentActions disabled={Boolean(conversation.readOnly) || uploading > 0} upload={upload} />
            }
            attachmentList={
              attachments.length ? (
                <NativeChatAttachmentList
                  attachments={attachments}
                  resolvedAttachments={host.attachments}
                  disabled={Boolean(conversation.readOnly)}
                  remove={(id) =>
                    // A shared file may still belong to a queue edit; remove only its draft reference.
                    changeActive({ attachments: attachments.filter((attachment) => attachment.id !== id) })
                  }
                />
              ) : undefined
            }
            queuedFollowUps={projectQueuedFollowUps(queuedFollowUps, pendingActions.queue)}
            onQueuedFollowUpSelect={(item) => {
              setSelected(item);
              if (item)
                setEdits((current) =>
                  current[item.id]
                    ? current
                    : {
                        ...current,
                        [item.id]: queuedChatDraft(draft, item),
                      },
                );
            }}
            onQueuedFollowUpDiscard={(id) => {
              setEdits((current) => {
                const { [id]: _discarded, ...rest } = current;
                return rest;
              });
            }}
            onQueuedFollowUpUpdate={(id, prompt) =>
              submitWithNativeChatAccount(host.account, prompt, () =>
                queue("update", selected?.id === id ? selected : find(id), { prompt }),
              )
            }
            onQueuedFollowUpCreate={(id, prompt) =>
              submitWithNativeChatAccount(host.account, prompt, () =>
                queue("create", selected?.id === id ? selected : find(id), { prompt }),
              )
            }
            canRestoreQueuedEditToDraft={!draft.attachments.length && !uploading}
            onQueuedFollowUpRestoreDraft={(id) => {
              const saved = edits[id];
              if (saved) session.changeDraft(saved);
            }}
            onQueuedFollowUpRemove={(id) => runQueueGesture(() => queue("remove", find(id)), session.reportError)}
            onQueuedFollowUpMove={(id, direction, steps, selection) =>
              runQueueGesture(
                () => queue("move", selection?.source ?? find(id), { direction, steps }),
                session.reportError,
              )
            }
            onQueuedFollowUpCombine={(source, target) => queue("combine", source, { target })}
            onQueuedFollowUpSteer={(item) => queue("steer", item)}
          />
        );
      }}
    </Host>
  );
};
