import { Box, Image, Link, Stack, Text } from "@chakra-ui/react";
import type { StoredTicketAttachment } from "../data/types";

const formatAttachmentSize = (size: number) => {
  if (size < 1024) return `${size.toString()} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024).toString()} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const canPreviewImage = (attachment: StoredTicketAttachment) =>
  attachment.mimeType?.startsWith("image/") && attachment.url.length > 0;

export const TicketAttachments = (props: { attachments?: StoredTicketAttachment[] }) => {
  const { attachments = [] } = props;
  if (attachments.length === 0) return null;

  return (
    <Stack gap="2xs">
      <Text textStyle="label/XS/medium" color="fg.muted" textTransform="uppercase">
        Attachments
      </Text>
      <Stack gap="xs">
        {attachments.map((attachment) => (
          <Box key={attachment.id} borderWidth="1px" borderColor="border" borderRadius="sm" overflow="hidden">
            {canPreviewImage(attachment) ? (
              <Image src={attachment.url} alt={attachment.name} w="full" maxH="120px" objectFit="cover" />
            ) : null}
            <Stack gap="0" p="xs">
              <Link href={attachment.url} target="_blank" rel="noreferrer" textStyle="paragraph/S/regular">
                {attachment.name}
              </Link>
              <Text textStyle="label/XS/regular" color="fg.muted">
                {formatAttachmentSize(attachment.size)}
              </Text>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
};
