import { Image } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { useTicketContent } from "../hooks/use-ticket-content";

interface TicketImagePreviewProps {
  projectId?: string;
  ticketId: string;
  fileId: string;
  fileName: string;
}

export const TicketImagePreview = (props: TicketImagePreviewProps) => {
  const { projectId, ticketId, fileId, fileName } = props;
  const content = useTicketContent(projectId, ticketId, fileId);

  return (
    <ScrollArea
      flex="1"
      minH="0"
      contentProps={{ p: "md", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <Image src={content.data ?? ""} alt={fileName} maxW="100%" maxH="100%" objectFit="contain" />
    </ScrollArea>
  );
};
