import { Flex, Stack } from "@chakra-ui/react";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import type { ComponentProps } from "react";
import { TicketDetailSidebar } from "../components/ticket-detail-sidebar";
import { TicketImagePreview } from "../components/ticket-image-preview";

type MarkdownEditorChangeHandler = NonNullable<ComponentProps<typeof MarkdownEditor>["onChange"]>;

interface TicketDetailsShellMainWidgetProps {
  allTickets: ComponentProps<typeof TicketDetailSidebar>["allTickets"];
  autoSaveEditorKey: string;
  autoSaveInitialContent: string;
  isContentReady: boolean;
  isDetailsPanelOpen: boolean;
  isImageFile: boolean;
  isUpdatingTags: boolean;
  project: ComponentProps<typeof TicketDetailSidebar>["project"];
  selectedFileId: string;
  selectedFileName: string;
  ticket: ComponentProps<typeof TicketDetailSidebar>["ticket"];
  ticketId: string;
  onEditorChange: MarkdownEditorChangeHandler;
  onSelectTicket: ComponentProps<typeof TicketDetailSidebar>["onSelectTicket"];
  onTagIdsChange: ComponentProps<typeof TicketDetailSidebar>["onTagIdsChange"];
  onToggleDetailsPanel: ComponentProps<typeof TicketDetailSidebar>["onToggle"];
  placeholder: string;
}

export const TicketDetailsShellMainWidget = (props: TicketDetailsShellMainWidgetProps) => {
  const {
    allTickets,
    autoSaveEditorKey,
    autoSaveInitialContent,
    isContentReady,
    isDetailsPanelOpen,
    isImageFile,
    isUpdatingTags,
    project,
    selectedFileId,
    selectedFileName,
    ticket,
    ticketId,
    onEditorChange,
    onSelectTicket,
    onTagIdsChange,
    onToggleDetailsPanel,
    placeholder,
  } = props;

  return (
    <Flex flex="1" h="full" minH="0" minW="0" overflow="hidden" css={{ containerType: "inline-size" }}>
      <Stack flex="1" h="full" minH="0" minW="0" overflow="hidden">
        {isImageFile ? (
          <TicketImagePreview ticketId={ticketId} fileId={selectedFileId} fileName={selectedFileName} />
        ) : isContentReady ? (
          <MarkdownEditor
            key={autoSaveEditorKey}
            defaultState={autoSaveInitialContent}
            isEditable
            placeholder={placeholder}
            onChange={onEditorChange}
          />
        ) : null}
      </Stack>

      <TicketDetailSidebar
        ticket={ticket}
        project={project}
        allTickets={allTickets}
        isOpen={isDetailsPanelOpen}
        isUpdatingTags={isUpdatingTags}
        onToggle={onToggleDetailsPanel}
        onSelectTicket={onSelectTicket}
        onTagIdsChange={onTagIdsChange}
      />
    </Flex>
  );
};
