import { Stack } from "@chakra-ui/react";
import { type ReactNode, useEffect, useState } from "react";
import type { ReferenceItem } from "@/components/rich-text";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatInput } from "./chat-input";
import type { ChatInputQuestionPrompt, ChatInputQuestionResponse } from "./chat-input-question-prompt";
import type { QueuedFollowUp } from "./message-types";
import { QueuedFollowUpList } from "./queued-follow-up-list";
import type { QueuedFollowUpMoveDirection } from "./queued-follow-up-list-state";

interface QueuedFollowUpComposerInput {
  queuedFollowUps: QueuedFollowUp[];
  defaultValue: string;
  onChange?: (text: string) => void;
  onSubmit?: (
    text: string,
    attachments: string[],
    questionResponse?: ChatInputQuestionResponse,
  ) => void | Promise<void>;
  onUpdate?: (itemId: string, prompt: string) => void;
}

interface ChatPanelComposerProps {
  conversationKey?: string;
  recentUserMessages: string[];
  actions?: ReactNode;
  attachedResources?: string[];
  attachmentList?: ReactNode;
  chatInputAutoFocus: boolean;
  chatInputPlaceholder: string;
  chatInputQuestionPrompt?: ChatInputQuestionPrompt;
  chatInputReferences: ReferenceItem[];
  hasWorkspaceHub: boolean;
  inputDisabled: boolean;
  submitDisabled: boolean;
  onAttachFiles?: (files: File[]) => void;
  onAttachText?: (text: string) => void;
  onChatInputAddReference?: (resourceId: string, resourceType: ReferenceItem["resourceType"]) => void;
  onClearAttachments?: () => void;
  onInterrupt?: () => void;
  onQueuedFollowUpMove?: (itemId: string, direction: QueuedFollowUpMoveDirection, steps?: number) => void;
  onQueuedFollowUpRemove?: (itemId: string) => void;
  onQueuedFollowUpUpdate?: (itemId: string, prompt: string) => void;
  queuedComposer: ReturnType<typeof useQueuedFollowUpComposer>;
  queuedFollowUps: QueuedFollowUp[];
  streaming: boolean;
  workspaceHub?: ReactNode;
}

export const useQueuedFollowUpComposer = (input: QueuedFollowUpComposerInput) => {
  const { queuedFollowUps, defaultValue, onChange, onSubmit, onUpdate } = input;
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editSeed, setEditSeed] = useState("");
  const [focusSignal, setFocusSignal] = useState(0);
  const inputValue = editingItemId ? editSeed : defaultValue;

  useEffect(() => {
    if (!editingItemId) return;
    if (queuedFollowUps.some((item) => item.id === editingItemId)) return;
    setEditingItemId(null);
    setEditSeed("");
  }, [editingItemId, queuedFollowUps]);

  const edit = (item: QueuedFollowUp) => {
    setEditingItemId(item.id);
    setEditSeed(item.prompt);
    setFocusSignal((signal) => signal + 1);
  };

  const change = (text: string) => {
    if (editingItemId) return;
    onChange?.(text);
  };

  const submit = (text: string, attachments: string[], questionResponse?: ChatInputQuestionResponse) => {
    if (editingItemId) {
      onUpdate?.(editingItemId, text);
      setEditingItemId(null);
      setEditSeed("");
      return;
    }

    return onSubmit?.(text, attachments, questionResponse);
  };

  return { change, edit, editingItemId, focusSignal, inputValue, isEditing: Boolean(editingItemId), submit };
};

export const ChatPanelComposer = (props: ChatPanelComposerProps) => {
  const {
    conversationKey,
    recentUserMessages,
    actions,
    attachedResources,
    attachmentList,
    chatInputAutoFocus,
    chatInputPlaceholder,
    chatInputQuestionPrompt,
    chatInputReferences,
    hasWorkspaceHub,
    inputDisabled,
    submitDisabled,
    onAttachFiles,
    onAttachText,
    onChatInputAddReference,
    onClearAttachments,
    onInterrupt,
    onQueuedFollowUpMove,
    onQueuedFollowUpRemove,
    onQueuedFollowUpUpdate,
    queuedComposer,
    queuedFollowUps,
    streaming,
    workspaceHub,
  } = props;
  const hasQueuedFollowUps = queuedFollowUps.length > 0;

  return (
    <Stack px={hasWorkspaceHub ? "2xs" : "xs"} gap="0">
      {/* Concentric hierarchy: the hub shell owns the visible border so the session reads
          as living inside the workspace; the nested input recedes to border.subtle. */}
      <Stack
        gap={hasWorkspaceHub ? "2xs" : "0"}
        p={hasWorkspaceHub ? "2xs" : undefined}
        borderWidth={hasWorkspaceHub ? "1px" : undefined}
        borderColor={hasWorkspaceHub ? "border" : undefined}
        borderRadius={hasWorkspaceHub ? "sm" : undefined}
        bg={hasWorkspaceHub ? "bg.subtle" : undefined}
      >
        {workspaceHub}
        <QueuedFollowUpList
          items={queuedFollowUps}
          editingItemId={queuedComposer.editingItemId}
          onEdit={onQueuedFollowUpUpdate ? queuedComposer.edit : undefined}
          onRemove={onQueuedFollowUpRemove}
          onMove={onQueuedFollowUpMove}
        />
        <ChatInput
          key={conversationKey}
          recentUserMessages={recentUserMessages}
          placeholder={chatInputPlaceholder}
          defaultState={createSerializedPromptState(queuedComposer.inputValue)}
          streaming={streaming}
          onSubmit={queuedComposer.submit}
          onInterrupt={onInterrupt}
          onAttachFiles={onAttachFiles}
          onAttachText={onAttachText}
          onChange={queuedComposer.change}
          actions={actions}
          attachedResources={attachedResources}
          onClearAttachments={onClearAttachments}
          attachmentList={attachmentList}
          isDisabled={inputDisabled}
          submitDisabled={submitDisabled}
          attachedToTop={hasQueuedFollowUps}
          recessed={hasWorkspaceHub}
          questionPrompt={chatInputQuestionPrompt}
          autoFocus={chatInputAutoFocus}
          focusSignal={queuedComposer.focusSignal}
          submitTitle={queuedComposer.isEditing ? "Save queued follow-up" : undefined}
          references={chatInputReferences}
          onAddReference={onChatInputAddReference}
        />
      </Stack>
    </Stack>
  );
};
