import { Box } from "@chakra-ui/react";
import type { ChatAttachment, ChatQueuedRequest } from "@pstdio/sdk/extensions";
import { type ChatLinkHandler, ChatPanel } from "@pstdio/ui/chat-ui";
import { type ComponentType, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { visibleChatDraftAttachments } from "../../../extensions/contributions/chat-pending-submission";
import type { ChatSession } from "../../../extensions/contributions/chat-session";
import type { CommandParamFieldRenderer } from "../../command-palette/command-param-field";
import { nativeChatInputHandler, submitWithNativeChatAccount } from "./native-chat-account-submit";
import { runNativeChatAction } from "./native-chat-action";
import { NativeChatAttachmentActions, NativeChatAttachmentList } from "./native-chat-attachments";
import { NativeChatApproval, NativeChatControls, nativeChatCommands } from "./native-chat-controls";
import type { NativeChatHostProps, NativeChatHostServices } from "./native-chat-host";
import { findQueuedChatRequest, queuedChatDraft } from "./native-chat-queue";
import { NativeChatNotices, NativeChatResources } from "./native-chat-status";

interface NativeChatViewProps extends NativeChatHostServices {
  Host?: ComponentType<NativeChatHostProps>;
  extensionId?: string;
  session: ChatSession;
  action: Parameters<ChatSession["run"]>[1];
  linkHandler?: ChatLinkHandler;
  conversationKey: string;
  refreshKey?: number;
  /** Hidden retained presentations must not request composer focus. */
  visible?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  renderParamField?: CommandParamFieldRenderer;
}

const encodeFile = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const accountBlocksSubmission = (account: NativeChatHostServices["account"], text: string) =>
  Boolean(account?.blocked && !account.isCommand(text));

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
  const { session, conversationKey, renderParamField } = props;
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const { conversation, draft, messages, queuedFollowUps, pending, loading, initializing, sending } = state;
  const run: ChatSession["run"] = (action) => runNativeChatAction(session, action, props.action, Boolean(selected));
  const [uploading, setUploading] = useState(0);
  const [selected, setSelected] = useState<ChatQueuedRequest | null>(null);
  const [edits, setEdits] = useState<Record<string, { values: typeof draft.values; attachments: ChatAttachment[] }>>(
    {},
  );
  useEffect(() => session.retain(), [session]);
  const refresh = useRef(props.refreshKey);
  useEffect(() => {
    if (refresh.current === props.refreshKey) return;
    refresh.current = props.refreshKey;
    session.reconnect();
  }, [props.refreshKey, session]);
  const edit = selected ? edits[selected.id] : undefined;
  const activeDraft = edit ? { ...draft, ...edit } : draft;
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
      for (const file of files) {
        const result = await run({
          type: "upload",
          name: file.name,
          mediaType: file.type,
          data: await encodeFile(file),
        });
        const attachment = result && "attachment" in result ? result.attachment : undefined;
        if (!attachment) throw new Error("The attachment was not uploaded.");
        if (target)
          setEdits((current) => {
            const currentDraft = current[target] ?? { values, attachments: [] };
            return {
              ...current,
              [target]: { ...currentDraft, attachments: [...currentDraft.attachments, attachment] },
            };
          });
        else session.changeDraft({ attachments: [...session.getSnapshot().draft.attachments, attachment] });
      }
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
  const Host = props.Host ?? PassthroughChatHost;
  return (
    <Host
      session={session}
      values={values}
      attachments={attachments}
      extensionId={props.extensionId}
      linkHandler={props.linkHandler}
    >
      {(host) => {
        const controls = (
          <NativeChatControls
            run={run}
            reconnect={session.reconnect}
            conversation={conversation}
            draft={activeDraft}
            editingQueuedRequest={Boolean(selected)}
            unavailable={host.account?.blocked}
            initializing={initializing}
            renderParamField={renderParamField}
            changeValues={(next) => changeActive({ values: next })}
          />
        );
        return (
          <ChatPanel
            conversationKey={conversationKey}
            linkHandler={host.linkHandler ?? props.linkHandler}
            messages={host.messages ?? messages}
            onForkMessage={
              conversation.fork ? (messageId) => run({ type: "fork", messageId }).then(() => undefined) : undefined
            }
            forkDisabledReason={
              conversation.fork?.disabledReason ??
              (conversation.readOnly ? "This conversation is read only." : undefined)
            }
            loading={loading}
            emptyStateTitle={props.emptyTitle ?? "No messages yet"}
            emptyStateDescription={props.emptyDescription ?? "Send a message to start this session."}
            chatInputPlaceholder="Reply to the agent..."
            chatInputAutoFocus={props.visible !== false}
            chatInputDefaultValue={draft.text}
            onChatInputChange={(text) => session.changeDraft({ text })}
            streaming={conversation.streaming}
            streamingStartedAt={conversation.streamingStartedAt}
            inputDisabled={sending || conversation.readOnly || uploading > 0 || Boolean(host.account?.progress)}
            submitDisabled={
              conversation.submitDisabled ||
              Boolean(selected && conversation.queueReadOnly) ||
              sending ||
              uploading > 0 ||
              accountBlocksSubmission(host.account, draft.text)
            }
            readOnlyQueue={conversation.readOnly || conversation.queueReadOnly}
            queueSteeringUnavailableReason={conversation.queueSteeringUnavailableReason}
            onSubmitMessage={nativeChatInputHandler({
              account: host.account,
              session,
              run,
              draft: { attachments, values },
            })}
            onInterrupt={
              conversation.streaming && !conversation.readOnly
                ? () => {
                    void run({ type: "stop" }).catch(() => undefined);
                  }
                : undefined
            }
            approvalPrompt={<NativeChatApproval run={run} conversation={conversation} />}
            chatInputCommands={nativeChatCommands(conversation, host.account, run, values)}
            composerDecision={
              conversation.decision
                ? {
                    ...conversation.decision,
                    controls,
                    pending: sending,
                    onAction: async (actionId) => {
                      await run({
                        type: "decision",
                        id: conversation.decision!.id,
                        actionId,
                        values,
                        modeSnapshot: conversation.decision!.modeSnapshot,
                      });
                    },
                  }
                : undefined
            }
            workspaceHub={<NativeChatResources resources={conversation.resources} run={run} />}
            actions={controls}
            conversationNotices={<NativeChatNotices host={host} state={state} session={session} />}
            onAttachFiles={(files) => {
              void upload(files).catch(() => undefined);
            }}
            onAttachText={(text) => {
              void upload([new File([text], "pasted-text.txt", { type: "text/plain" })]).catch(() => undefined);
            }}
            attachmentActions={
              <NativeChatAttachmentActions
                disabled={Boolean(conversation.readOnly) || uploading > 0}
                upload={(files) => {
                  void upload(files).catch(() => undefined);
                }}
              />
            }
            attachmentList={
              <NativeChatAttachmentList
                attachments={attachments}
                resolvedAttachments={host.attachments}
                disabled={Boolean(conversation.readOnly)}
                remove={(id) =>
                  // A shared file may still belong to a queue edit; remove only its draft reference.
                  changeActive({ attachments: attachments.filter((attachment) => attachment.id !== id) })
                }
              />
            }
            queuedFollowUps={queuedFollowUps}
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
            onQueuedFollowUpRemove={(id) =>
              void Promise.resolve()
                .then(() => queue("remove", find(id)))
                .catch(session.reportError)
            }
            onQueuedFollowUpMove={(id, direction, steps, selection) =>
              void Promise.resolve()
                .then(() => queue("move", selection?.source ?? find(id), { direction, steps }))
                .catch(session.reportError)
            }
            onQueuedFollowUpCombine={(source, target) => queue("combine", source, { target })}
            onQueuedFollowUpSteer={(item) => queue("steer", item)}
          />
        );
      }}
    </Host>
  );
};
