import type { ChatAttachment, ChatQueuedRequest } from "@pstdio/sdk/extensions";
import { type ChatLinkHandler, ChatPanel } from "@pstdio/ui/chat-ui";
import { type ComponentType, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChatSession } from "../../../extensions/contributions/chat-session";
import type { CommandParamFieldRenderer } from "../../command-palette/command-param-field";
import { submitWithNativeChatAccount } from "./native-chat-account-submit";
import { runNativeChatAction } from "./native-chat-action";
import { NativeChatAttachmentActions, NativeChatAttachmentList } from "./native-chat-attachments";
import { NativeChatApproval, NativeChatControls, nativeChatCommands } from "./native-chat-controls";
import type { NativeChatHostProps, NativeChatHostServices } from "./native-chat-host";
import { queuedChatDraft } from "./native-chat-queue";
import { NativeChatNotices, NativeChatResources } from "./native-chat-status";

interface NativeChatViewProps extends NativeChatHostServices {
  Host?: ComponentType<NativeChatHostProps>;
  extensionId?: string;
  session: ChatSession;
  action: Parameters<ChatSession["run"]>[1];
  linkHandler?: ChatLinkHandler;
  conversationKey: string;
  refreshKey?: number;
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

export const NativeChatView = (props: NativeChatViewProps) => {
  const { session, conversationKey, renderParamField } = props;
  const { conversation, draft, loading, initializing, sending, error } = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
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
  const attachments = activeDraft.attachments;
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
  const find = (id: string) => {
    const item = conversation.queuedFollowUps?.find((candidate) => candidate.id === id);
    if (!item) throw new Error("The queued request is no longer available.");
    return item;
  };
  const removeAttachment = (id: string) => {
    // Removing a chip only removes its draft reference. A shared file may still belong to a queue edit.
    changeActive({ attachments: attachments.filter((attachment) => attachment.id !== id) });
  };
  const Host = props.Host ?? PassthroughChatHost;
  return (
    <Host
      session={session}
      values={values}
      attachments={attachments}
      extensionId={props.extensionId}
      linkHandler={props.linkHandler}
    >
      {(host) => (
        <ChatPanel
          conversationKey={conversationKey}
          linkHandler={host.linkHandler ?? props.linkHandler}
          messages={host.messages ?? conversation.messages ?? []}
          onForkMessage={
            conversation.fork ? (messageId) => run({ type: "fork", messageId }).then(() => undefined) : undefined
          }
          forkDisabledReason={
            conversation.fork?.disabledReason ?? (conversation.readOnly ? "This conversation is read only." : undefined)
          }
          loading={loading}
          emptyStateTitle={props.emptyTitle ?? "No messages yet"}
          emptyStateDescription={props.emptyDescription ?? "Send a message to start this session."}
          chatInputPlaceholder="Reply to the agent..."
          chatInputDefaultValue={draft.text}
          onChatInputChange={(text) => session.changeDraft({ text })}
          streaming={conversation.streaming}
          streamingStartedAt={conversation.streamingStartedAt}
          inputDisabled={conversation.readOnly || uploading > 0 || Boolean(host.account?.progress)}
          submitDisabled={
            conversation.submitDisabled ||
            Boolean(selected && conversation.queueReadOnly) ||
            sending ||
            uploading > 0 ||
            accountBlocksSubmission(host.account, draft.text)
          }
          readOnlyQueue={conversation.readOnly || conversation.queueReadOnly}
          onSubmitMessage={(text, _files, questionResponse) =>
            submitWithNativeChatAccount(host.account, questionResponse ? undefined : text, () =>
              run({ type: "submit", text, attachments: questionResponse ? [] : attachments, values, questionResponse }),
            )
          }
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
          actions={
            <NativeChatControls
              run={run}
              conversation={conversation}
              draft={activeDraft}
              editingQueuedRequest={Boolean(selected)}
              unavailable={host.account?.blocked}
              initializing={initializing}
              renderParamField={renderParamField}
              changeValues={(next) => changeActive({ values: next })}
            />
          }
          conversationNotices={
            <NativeChatNotices host={host} notice={conversation.notice} error={error} draft={draft} session={session} />
          }
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
              remove={removeAttachment}
            />
          }
          queuedFollowUps={conversation.queuedFollowUps}
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
          onQueuedFollowUpRemove={(id) => {
            void queue("remove", find(id)).catch(() => undefined);
          }}
          onQueuedFollowUpMove={(id, direction, steps, selection) => {
            void queue("move", selection?.source ?? find(id), { direction, steps }).catch(() => undefined);
          }}
          onQueuedFollowUpCombine={(source, target) => queue("combine", source, { target })}
          onQueuedFollowUpSteer={(item) => queue("steer", item)}
        />
      )}
    </Host>
  );
};
