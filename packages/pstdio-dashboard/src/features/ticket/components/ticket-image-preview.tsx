import { Box, Image } from "@chakra-ui/react";
import { buildApiUrl } from "@/lib/api";

interface TicketImagePreviewProps {
  fileId: string;
  fileName: string;
}

export const TicketImagePreview = (props: TicketImagePreviewProps) => {
  const { fileId, fileName } = props;
  const src = buildApiUrl(`/v1/files/${fileId}/content`);

  return (
    <Box flex="1" minH="0" overflow="auto" p="md" display="flex" alignItems="center" justifyContent="center">
      <Image src={src} alt={fileName} maxW="100%" maxH="100%" objectFit="contain" />
    </Box>
  );
};
