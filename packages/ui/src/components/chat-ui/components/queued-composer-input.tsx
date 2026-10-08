import { Button } from "@chakra-ui/react";
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
  const updateLabel = queuedComposer.updating ? "Updating…" : "Update";
  return (
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
      actions={
        <>
          {actions}
          {editing ? (
            <Button
              size="xs"
              variant="ghost"
              onClick={queuedComposer.discard}
              disabled={queuedComposer.updating || inputDisabled}
            >
              Cancel
            </Button>
          ) : null}
        </>
      }
      attachmentActions={attachmentActions}
      attachedResources={attachedResources}
      onClearAttachments={onClearAttachments}
      attachmentList={attachmentList}
      isDisabled={inputDisabled || queuedComposer.updating}
      submitDisabled={submitDisabled || (editing && queuedComposer.stale)}
      attachedToTop={hasQueuedFollowUps}
      recessed={hasWorkspaceHub}
      questionPrompt={chatInputQuestionPrompt}
      decision={composerDecision}
      autoFocus={chatInputAutoFocus}
      focusSignal={queuedComposer.focusSignal}
      submitTitle={editing ? "Update" : undefined}
      submitLabel={editing ? updateLabel : undefined}
      retainTextUntilAcknowledged={editing}
      commands={chatInputCommands}
    />
  );
};
