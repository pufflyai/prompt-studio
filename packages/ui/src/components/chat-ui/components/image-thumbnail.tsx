import { Box, Image } from "@chakra-ui/react";
import type { FilePart } from "../agent-types";

export interface ImageThumbnailProps {
  file: FilePart;
}

const isImageMediaType = (mediaType?: string) => {
  if (!mediaType) return false;
  return mediaType.startsWith("image/");
};

const IMAGE_MAX_SIZE = 120;
const IMAGE_MIN_SIZE = 60;

export function ImageThumbnail(props: ImageThumbnailProps) {
  const { file } = props;
  const isImage = isImageMediaType(file.mediaType) || isImageUrl(file.url);

  if (!isImage) return null;

  return (
    <Box
      display="inline-block"
      borderRadius="md"
      overflow="hidden"
      maxW={`${IMAGE_MAX_SIZE}px`}
      maxH={`${IMAGE_MAX_SIZE}px`}
      position="relative"
    >
      <Image
        src={file.url}
        alt={file.filename ?? "Image attachment"}
        objectFit="cover"
        w={`${IMAGE_MAX_SIZE}px`}
        h={`${IMAGE_MAX_SIZE}px`}
        minW={`${IMAGE_MIN_SIZE}px`}
        minH={`${IMAGE_MIN_SIZE}px`}
      />
    </Box>
  );
}

function isImageUrl(url: string): boolean {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some((ext) => lowerUrl.includes(ext)) || url.includes("image");
}
