import { Image } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";

interface TicketImagePreviewProps {
  ticketId: string;
  fileId: string;
  fileName: string;
}

export const TicketImagePreview = (props: TicketImagePreviewProps) => {
  const { ticketId, fileId, fileName } = props;
  const src = `/v1/tickets/${ticketId}/files/${fileId}/content`;

  return (
    <ScrollArea
      flex="1"
      minH="0"
      contentProps={{ p: "md", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <Image src={src} alt={fileName} maxW="100%" maxH="100%" objectFit="contain" />
    </ScrollArea>
  );
};
