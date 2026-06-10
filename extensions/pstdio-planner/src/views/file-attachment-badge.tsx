import { Badge, chakra, IconButton, Image, Popover, Text } from "@chakra-ui/react";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTicketTranslation } from "../hooks/host-context";

interface FileAttachmentBadgeProps {
  file: File;
  disabled?: boolean;
  onRemove: () => void;
}

const isImage = (file: File) => file.type.startsWith("image/");

export const FileAttachmentBadge = (props: FileAttachmentBadgeProps) => {
  const { file, disabled, onRemove } = props;
  const t = useTicketTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Object URLs are only needed for image previews; revoke on unmount/file swap
  // so we don't leak blobs while the modal is open.
  useEffect(() => {
    if (!isImage(file)) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const name = (
    <Text as="span" textStyle="label/XS/medium" lineClamp={1} maxW="180px">
      {file.name}
    </Text>
  );

  return (
    <Badge variant="subtle" colorPalette="gray" gap="2xs" pr="2xs">
      {previewUrl ? (
        <Popover.Root positioning={{ placement: "top" }}>
          <Popover.Trigger asChild>
            <chakra.button type="button" cursor="pointer" minW="0" display="inline-flex">
              {name}
            </chakra.button>
          </Popover.Trigger>
          <Popover.Positioner>
            <Popover.Content w="auto" p="2xs" bg="bg">
              <Image src={previewUrl} alt={file.name} maxW="240px" maxH="240px" borderRadius="sm" />
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Root>
      ) : (
        name
      )}
      <IconButton
        size="2xs"
        variant="ghost"
        aria-label={t("createTicketModal.removeFile", "Remove {{name}}", { name: file.name })}
        disabled={disabled}
        onClick={onRemove}
      >
        <X size={12} />
      </IconButton>
    </Badge>
  );
};
