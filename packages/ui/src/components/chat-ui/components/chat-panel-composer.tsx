import { Box, Stack, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { chatComposerRecipe } from "@/theme/recipes/chat-composer";
import { queuedFollowUpRecipe } from "@/theme/recipes/queued-follow-up";
import type { useQueuedFollowUpComposer } from "./use-queued-follow-up-composer";

export { useQueuedFollowUpComposer } from "./use-queued-follow-up-composer";

import type { PromptCommand } from "@/components/rich-text";
import type { ChatInputQuestionPrompt } from "./chat-input-question-prompt";
import type { ComposerDecision } from "./composer-decision";
import type { QueuedFollowUp } from "./message-types";
import { QueuedComposerInput } from "./queued-composer-input";
import { QueuedFollowUpList } from "./queued-follow-up-list";
import type { QueuedFollowUpMoveDirection } from "./queued-follow-up-list-state";

export interface ChatPanelComposerProps {
  conversationKey?: string;
  recentUserMessages: string[];
  actions?: ReactNode;
  /** Attachment controls shown only while editing a message draft. */
  attachmentActions?: ReactNode;
  composerHeader?: ReactNode;
  composerFallback?: ReactNode;
  attachedResources?: string[];
  attachmentList?: ReactNode;
  chatInputAutoFocus: boolean;
  chatInputPlaceholder: string;
  chatInputQuestionPrompt?: ChatInputQuestionPrompt;
  composerDecision?: ComposerDecision;
  chatInputCommands: PromptCommand[];
  hasWorkspaceHub: boolean;
  inputDisabled: boolean;
  submitDisabled: boolean;
  onAttachFiles?: (files: File[]) => void;
  onAttachText?: (text: string) => void;
  onClearAttachments?: () => void;
  onInterrupt?: () => void;
  onQueuedFollowUpMove?: (
    itemId: string,
    direction: QueuedFollowUpMoveDirection,
    steps?: number,
    selection?: { source: QueuedFollowUp; items: QueuedFollowUp[] },
  ) => void;
  onQueuedFollowUpRemove?: (itemId: string) => void;
  onQueuedFollowUpUpdate?: (itemId: string, prompt: string) => void | Promise<void>;
  onQueuedFollowUpSteer?: (item: QueuedFollowUp) => void | Promise<void>;
  onQueuedFollowUpCombine?: (source: QueuedFollowUp, target: QueuedFollowUp) => void | Promise<void>;
  queueSteeringUnavailableReason?: string | null;
  unsavedQueueItemIds?: string[];
  queuedComposer: ReturnType<typeof useQueuedFollowUpComposer>;
  queuedFollowUps: QueuedFollowUp[];
  streaming: boolean;
  workspaceHub?: ReactNode;
}

export const ChatPanelComposer = (props: ChatPanelComposerProps) => {
  const {
    composerHeader,
    composerFallback,
    chatInputQuestionPrompt,
    composerDecision,
    hasWorkspaceHub,
    onQueuedFollowUpMove,
    onQueuedFollowUpRemove,
    onQueuedFollowUpUpdate,
    onQueuedFollowUpSteer,
    onQueuedFollowUpCombine,
    queueSteeringUnavailableReason,
    unsavedQueueItemIds = [],
    queuedComposer,
    queuedFollowUps,
    workspaceHub,
  } = props;
  const styles = useSlotRecipe({ recipe: queuedFollowUpRecipe })();
  const composerStyles = useSlotRecipe({ recipe: chatComposerRecipe })({ workspace: hasWorkspaceHub });
  if (composerFallback) return <Box p="xs">{composerFallback}</Box>;
  const hasQueuedFollowUps = queuedFollowUps.length > 0;

  const editing = queuedComposer.isEditing && !chatInputQuestionPrompt && !composerDecision;
  const editor = <QueuedComposerInput {...props} editing={editing} hasQueuedFollowUps={hasQueuedFollowUps} />;
  return (
    <Stack p="xs" gap="0">
      <Box className="ps-chat-composer__workspace" css={composerStyles.workspace}>
        {workspaceHub}
        {composerHeader}
        <QueuedFollowUpList
          items={queuedFollowUps}
          editor={editing ? editor : undefined}
          retainedEditor={editing && queuedComposer.createNew ? editor : undefined}
          retainedEditorPosition={queuedComposer.editingItem?.position}
          dirtyItemIds={[...queuedComposer.dirtyItemIds, ...unsavedQueueItemIds]}
          steeringUnavailableReason={queueSteeringUnavailableReason}
          onSteer={onQueuedFollowUpSteer}
          onCombine={onQueuedFollowUpCombine}
          editingItemId={queuedComposer.editingItemId}
          onEdit={onQueuedFollowUpUpdate ? queuedComposer.edit : undefined}
          onRemove={onQueuedFollowUpRemove}
          onMove={onQueuedFollowUpMove}
        />
        {editing ? (
          <Box css={styles.draft} asChild>
            <button type="button" onClick={queuedComposer.selectDraft} aria-label="Edit saved draft">
              {queuedComposer.draftValue || "Saved draft · select to edit"}
            </button>
          </Box>
        ) : (
          editor
        )}
      </Box>
    </Stack>
  );
};
