import { Button, Flex, Text } from "@chakra-ui/react";
import type { ChatAttachment, ChatQueuedRequest } from "@pstdio/sdk/extensions";
import { type ChatLinkHandler, ChatPanel } from "@pstdio/ui/chat-ui";
import { type ComponentType, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChatSession } from "../../../extensions/contributions/chat-session";
import type { CommandParamFieldRenderer } from "../../command-palette/command-param-field";
import { NativeChatAttachmentActions, NativeChatAttachmentList } from "./native-chat-attachments";
import { NativeChatApproval, NativeChatControls, nativeChatCommands } from "./native-chat-controls";
import { NativeChatDraftRecovery } from "./native-chat-draft-recovery";
import type { NativeChatHostProps, NativeChatHostServices } from "./native-chat-host";
import { queuedChatDraft } from "./native-chat-queue";

interface NativeChatViewProps extends NativeChatHostServices {
  Host?: ComponentType<NativeChatHostProps>;
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

export const NativeChatView = (props: NativeChatViewProps) =>
  props.Host ? (
    <props.Host session={props.session} linkHandler={props.linkHandler}>
      {(host) => <NativeChatContent {...props} {...host} />}
    </props.Host>
  ) : (
    <NativeChatContent {...props} />
  );

const NativeChatContent = (props: NativeChatViewProps) => {
  const { session, conversationKey, renderParamField } = props;
  const { conversation, draft, loading, sending, error } = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const run: ChatSession["run"] = (action) => session.run(action, props.action);
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
  return (
    <ChatPanel
      conversationKey={conversationKey}
      linkHandler={props.linkHandler}
      messages={conversation.messages ?? []}
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
      inputDisabled={conversation.readOnly || uploading > 0 || Boolean(props.account?.progress)}
      submitDisabled={
        conversation.submitDisabled ||
        sending ||
        uploading > 0 ||
        (props.account?.blocked && !props.account.isCommand(draft.text))
      }
      readOnlyQueue={conversation.readOnly}
      onSubmitMessage={async (text, _files, questionResponse) => {
        if (props.account?.progress)
          throw new Error("Finish or cancel harness authentication before sending a message.");
        if (!questionResponse && props.account?.isCommand(text)) {
          await props.account.submit(text);
          return;
        }
        props.account?.assertReady();
        await run({ type: "submit", text, attachments: questionResponse ? [] : attachments, values, questionResponse });
      }}
      onInterrupt={
        conversation.streaming && !conversation.readOnly
          ? () => {
              void run({ type: "stop" }).catch(() => undefined);
            }
          : undefined
      }
      approvalPrompt={<NativeChatApproval run={run} conversation={conversation} />}
      chatInputCommands={nativeChatCommands(conversation, props.account, run)}
      composerDecision={
        conversation.decision
          ? {
              ...conversation.decision,
              pending: sending,
              onAction: async (actionId) => {
                await run({ type: "decision", id: conversation.decision!.id, actionId });
              },
            }
          : undefined
      }
      workspaceHub={
        conversation.resources?.length ? (
          <Flex gap="xs">
            {conversation.resources.map((resource) => (
              <Button
                key={resource.id}
                variant="ghost"
                size="xs"
                onClick={() => void run({ type: "openResource", id: resource.id }).catch(() => undefined)}
              >
                {resource.label}
                {resource.additions === undefined ? null : <Text color="fg.success">+{resource.additions}</Text>}
                {resource.deletions === undefined ? null : <Text color="fg.error">−{resource.deletions}</Text>}
              </Button>
            ))}
          </Flex>
        ) : undefined
      }
      actions={
        <NativeChatControls
          run={run}
          conversation={conversation}
          draft={activeDraft}
          editingQueuedRequest={Boolean(selected)}
          unavailable={props.account?.blocked}
          renderParamField={renderParamField}
          changeValues={(next) => changeActive({ values: next })}
        />
      }
      conversationNotices={
        <>
          {props.account?.progress}
          {props.account?.notice}
          {props.linkNotice}
          <NativeChatDraftRecovery recovered={draft.recovered} onRestore={session.restoreDraft} />
          {conversation.notice ? <Text>{conversation.notice}</Text> : null}
          {error ? (
            <Flex direction="column" gap="xs">
              <Text role="alert">{error}</Text>
              <Button size="xs" variant="ghost" onClick={session.reconnect}>
                Retry
              </Button>
            </Flex>
          ) : null}
        </>
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
      onQueuedFollowUpUpdate={(id, prompt) => queue("update", selected?.id === id ? selected : find(id), { prompt })}
      onQueuedFollowUpCreate={(id, prompt) => queue("create", selected?.id === id ? selected : find(id), { prompt })}
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
  );
};
