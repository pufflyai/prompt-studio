import type { PendingQueuedFollowUpsResponse } from "@pstdio/sdk/api";
import { ChatPanel } from "@pstdio/ui/chat-ui";
import type { ComponentProps } from "react";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { useQueuedSessionMessages } from "../hooks/use-queued-session-messages";
import { SessionAttachmentControls } from "./session-attachment-controls";
import { SessionAttachmentList } from "./session-attachment-list";
import { SessionChatNotices } from "./session-chat-notices";
import { SessionComposerActions } from "./session-composer-actions";
import { useQueuedRequestSelection } from "./use-queued-request-selection";
import type { useSessionDraftAttachments } from "./use-session-draft-attachments";

interface SessionQueuedChatPanelProps extends ComponentProps<typeof ChatPanel> {
  projectId?: string;
  sessionId: string | null;
  draftKey: string;
  drafts?: DashboardSessionDraftPersistence;
  queue?: PendingQueuedFollowUpsResponse;
  refreshQueue(): void;
  draftAttachments: ReturnType<typeof useSessionDraftAttachments>;
  modelControls: ComponentProps<typeof SessionComposerActions>;
}

export const SessionQueuedChatPanel = (props: SessionQueuedChatPanelProps) => {
  const { projectId, sessionId, draftKey, drafts, queue, refreshQueue, draftAttachments, modelControls, ...panel } =
    props;
  const selection = useQueuedRequestSelection(projectId, draftKey, drafts);
  const files = selection.selection ? selection.attachments : draftAttachments;
  const actions = useQueuedSessionMessages({
    sessionId,
    queuedFollowUps: panel.queuedFollowUps ?? [],
    refreshQueue,
    activeRunStartedAt: queue?.activeRunStartedAt,
    editRequest: (id, prompt) => {
      const edit = selection.edits[id];
      if (!edit?.item.revision) throw new Error("Refresh the queue before editing this request.");
      return {
        prompt,
        expectedRevision: edit.item.revision,
        model: edit.model || null,
        params: edit.params,
        attachments: selection.attachments.attachments.map((file) => ({ file_id: file.file_id })),
      };
    },
    afterUpdate: selection.commit,
  });
  const refresh = () => {
    actions.clearActionError();
    refreshQueue();
  };
  return (
    <ChatPanel
      {...panel}
      conversationNotices={
        <>
          {panel.conversationNotices}
          <SessionChatNotices
            queueError={actions.actionError ? { message: actions.actionError, temporary: false } : undefined}
            reconnect={refresh}
            refreshQueue={refresh}
          />
        </>
      }
      onQueuedFollowUpUpdate={sessionId ? actions.handleQueuedFollowUpUpdate : undefined}
      onQueuedFollowUpSelect={selection.select}
      onQueuedFollowUpDiscard={selection.discard}
      onQueuedFollowUpCombine={actions.handleQueuedFollowUpCombine}
      onQueuedFollowUpSteer={actions.handleQueuedFollowUpSteer}
      queueSteeringUnavailableReason={
        queue ? queue.steeringUnavailableReason : "Refresh the queue to check live input support."
      }
      unsavedQueueItemIds={selection.dirtyItemIds}
      onQueuedFollowUpRemove={sessionId ? actions.handleQueuedFollowUpRemove : undefined}
      onQueuedFollowUpMove={sessionId ? actions.handleQueuedFollowUpMove : undefined}
      actions={
        <SessionComposerActions
          {...modelControls}
          selectedModel={selection.selection?.model ?? modelControls.selectedModel}
          setSelectedModel={selection.selection ? selection.setModel : modelControls.setSelectedModel}
          harnessParamOverrides={selection.selection?.params ?? modelControls.harnessParamOverrides}
          setHarnessParamOverrides={selection.selection ? selection.setParams : modelControls.setHarnessParamOverrides}
          selectionScope={selection.selection ? "request" : "draft"}
        />
      }
      attachmentActions={
        <SessionAttachmentControls
          projectId={projectId}
          uploading={files.uploading}
          onAttachFiles={(values) => void files.uploadFiles(values)}
        />
      }
      attachmentList={
        files.attachments.length ? (
          <SessionAttachmentList attachments={files.attachments} onRemove={files.removeAttachment} />
        ) : undefined
      }
      onAttachFiles={projectId ? (values) => void files.uploadFiles(values) : undefined}
      onAttachText={projectId ? (text) => void files.uploadText(text) : undefined}
      inputDisabled={files.uploading}
    />
  );
};
