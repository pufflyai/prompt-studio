import { HStack, Image } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import type { SnapshotImage } from "../schemas";
import { threadMedia } from "../store";
import { useRadar } from "../webview/client";

interface ThreadImagesProps {
  threadId: string;
  images?: SnapshotImage[];
}
/** The copies a run kept of the images in a post or comment. */
export const ThreadImages = (props: ThreadImagesProps) => {
  const { threadId, images = [] } = props;
  const { client } = useRadar();
  const urls = useQuery({
    queryKey: ["thread-images", threadId, images.map((image) => image.file)],
    queryFn: () =>
      Promise.all(images.map((image) => client.artifacts.imageUrl(threadMedia, `${threadId}/${image.file}`))),
    enabled: images.length > 0,
  });
  if (!urls.data) return null;
  return (
    <HStack gap="sm" wrap="wrap" align="start">
      {images.map((image, index) => (
        <Image key={image.file} src={urls.data[index]} alt={image.alt ?? ""} maxH="96" maxW="full" borderRadius="sm" />
      ))}
    </HStack>
  );
};
