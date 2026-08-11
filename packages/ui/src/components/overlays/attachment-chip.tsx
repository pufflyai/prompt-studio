import { Badge, chakra, IconButton, Image, Popover, Text } from "@chakra-ui/react";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

export interface AttachmentChipProps {
  file: File;
  /** Accessible label for the remove control; the caller owns translation. */
  removeLabel: string;
  disabled?: boolean;
  onRemove: () => void;
}

const isImage = (file: File) => file.type.startsWith("image/");

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes.toString()} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toString()} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * A file queued for upload, before the resource it belongs to exists. Removal
 * lives on the chip because there is no other surface between picking a file
 * and submitting where a mistaken attachment can be taken back.
 */
export const AttachmentChip = (props: AttachmentChipProps) => {
  const { file, removeLabel, disabled, onRemove } = props;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Object URLs are only needed for image previews; revoke on unmount/file swap
  // so we don't leak blobs while the dialog is open.
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
    <Badge variant="chip" gap="2xs" pr="2xs">
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
      <Text as="span" textStyle="label/XS/regular" color="fg.subtle">
        {formatSize(file.size)}
      </Text>
      <IconButton size="2xs" variant="ghost" aria-label={removeLabel} disabled={disabled} onClick={onRemove}>
        <X size={12} />
      </IconButton>
    </Badge>
  );
};
