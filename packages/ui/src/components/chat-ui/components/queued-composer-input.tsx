import { Box, Button, Text } from "@chakra-ui/react";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatInput } from "./chat-input";
import type { ChatPanelComposerProps } from "./chat-panel-composer";

interface QueuedComposerInputProps extends ChatPanelComposerProps {
  editing: boolean;
  hasQueuedFollowUps: boolean;
}
export const QueuedComposerInput = (props: QueuedComposerInputProps) => {
  const {
    conversationKey,
    recentUserMessages,
    actions,
    attachmentActions,
    attachedResources,
    attachmentList,
    chatInputAutoFocus,
    chatInputPlaceholder,
    chatInputQuestionPrompt,
    composerDecision,
    chatInputCommands,
    hasWorkspaceHub,
    inputDisabled,
    submitDisabled,
    onAttachFiles,
    onAttachText,
    onClearAttachments,
    onInterrupt,
    queuedComposer,
    streaming,
  } = props;
  const { editing, hasQueuedFollowUps } = props;
  const actionLabel = queuedComposer.createNew ? "Create new queue item" : "Update";
  const updateLabel = queuedComposer.updating ? "Saving…" : actionLabel;
  return (
    <Box
      onKeyDown={(event) => {
        if (
          event.key !== "Escape" ||
          event.defaultPrevented ||
          event.nativeEvent.isComposing ||
          !editing ||
          inputDisabled ||
          queuedComposer.updating ||
          !event.currentTarget.contains(event.target as Node)
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        queuedComposer.discard();
      }}
    >
      <ChatInput
        key={`${conversationKey ?? ""}:${queuedComposer.editingItemId ?? "draft"}`}
        recentUserMessages={recentUserMessages}
        placeholder={chatInputPlaceholder}
        defaultState={queuedComposer.editorState ?? createSerializedPromptState(queuedComposer.inputValue)}
        streaming={editing ? false : streaming}
        onSubmit={queuedComposer.submit}
        onInterrupt={editing ? undefined : onInterrupt}
        onAttachFiles={onAttachFiles}
        onAttachText={onAttachText}
        onChange={queuedComposer.change}
        onEditorStateChange={queuedComposer.changeState}
        initialSelection={queuedComposer.initialSelection}
        onSelectionChange={queuedComposer.changeSelection}
        actions={actions}
        submitActions={
          editing ? (
            <Button
              size="xs"
              variant="ghost"
              onClick={queuedComposer.discard}
              disabled={queuedComposer.updating || inputDisabled}
            >
              Cancel
            </Button>
          ) : null
        }
        attachmentActions={attachmentActions}
        attachedResources={attachedResources}
        onClearAttachments={onClearAttachments}
        attachmentList={attachmentList}
        isDisabled={inputDisabled || queuedComposer.updating}
        submitDisabled={submitDisabled || (editing && queuedComposer.stale)}
        attachedToTop={!editing && hasQueuedFollowUps}
        recessed={hasWorkspaceHub}
        questionPrompt={chatInputQuestionPrompt}
        decision={composerDecision}
        autoFocus={chatInputAutoFocus}
        focusSignal={queuedComposer.focusSignal}
        submitTitle={editing ? actionLabel : undefined}
        submitLabel={editing ? updateLabel : undefined}
        retainTextUntilAcknowledged={editing}
        commands={chatInputCommands}
      />
      <QueuedComposerNotice queuedComposer={queuedComposer} editing={editing} />
    </Box>
  );
};

const QueuedComposerNotice = (props: Pick<QueuedComposerInputProps, "queuedComposer" | "editing">) => {
  const { queuedComposer, editing } = props;
  const stale = editing && queuedComposer.stale;
  const notice =
    queuedComposer.error ??
    (stale
      ? "This request changed. Your edit is kept; select the saved request again before updating."
      : queuedComposer.notice);
  if (!notice) return null;
  const failure = Boolean(queuedComposer.error || stale);
  return (
    <Text
      mt="2xs"
      color={failure ? "fg.error" : "fg.muted"}
      textStyle="label/S/regular"
      role={failure ? "alert" : "status"}
      aria-label="Queued edit notice"
    >
      {notice}
    </Text>
  );
};
