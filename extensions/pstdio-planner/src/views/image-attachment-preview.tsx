import { Center, Image, Spinner, Text } from "@chakra-ui/react";
import { useCommandQuery } from "../hooks/use-command";

const READ_ATTACHMENT = "pstdio-planner.read-ticket-attachment";

interface ImageAttachmentPreviewProps {
  ticketId: string;
  attachmentId: string;
  name: string;
}

// Image attachments are read-only. We fetch the bytes as a data URL through a
// command because the sandboxed webview can't load the attachment's host URL.
export const ImageAttachmentPreview = (props: ImageAttachmentPreviewProps) => {
  const { ticketId, attachmentId, name } = props;

  const previewQuery = useCommandQuery<{ dataUrl: string } | null>({
    queryKey: ["ticket-attachment", ticketId, attachmentId],
    commandId: READ_ATTACHMENT,
    params: { ticketId, attachmentId },
  });

  if (previewQuery.isPending) {
    return (
      <Center h="full" minH="0">
        <Spinner />
      </Center>
    );
  }

  // The command resolves to null for a missing attachment and getBytes can throw,
  // so a settled-but-empty query needs its own state instead of a forever spinner.
  if (previewQuery.isError || !previewQuery.data) {
    return (
      <Center h="full" minH="0" p="md">
        <Text color="fg.muted">This image preview is unavailable.</Text>
      </Center>
    );
  }

  return (
    <Center h="full" minH="0" p="md" overflow="auto">
      <Image src={previewQuery.data.dataUrl} alt={name} maxW="100%" maxH="100%" objectFit="contain" />
    </Center>
  );
};
