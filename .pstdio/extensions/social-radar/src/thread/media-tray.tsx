import { Box, HStack, Icon, Image, Stack, Text } from "@chakra-ui/react";
import { Chip } from "@pstdio/ui";
import { useQuery } from "@tanstack/react-query";
import { Film, Info } from "lucide-react";
import { describeMediaRule, type MediaRule, mediaType } from "../sites";
import { postMedia } from "../store";
import { useRadar } from "../webview/client";

interface MediaTrayProps {
  threadId: string;
  channelName: string;
  rule: MediaRule;
}
/** The thread's folder in the post-media mount is the media list; the agent fills it with add-media. */
export const MediaTray = (props: MediaTrayProps) => {
  const { threadId, channelName, rule } = props;
  const { client } = useRadar();
  const media = useQuery({
    queryKey: ["media", threadId],
    queryFn: async () => {
      const files = await client.artifacts.list(postMedia, `${threadId}/`);
      return Promise.all(
        files.map(async (file) => ({
          path: file.path,
          name: file.path.split("/").pop() ?? file.path,
          url: mediaType(file.path) === "image" ? await client.artifacts.imageUrl(postMedia, file.path) : null,
        })),
      );
    },
  });
  return (
    <Stack gap="sm">
      {media.data?.length ? (
        <HStack gap="sm" wrap="wrap" align="start">
          {media.data.map((file) =>
            file.url ? (
              <Image key={file.path} src={file.url} alt={file.name} maxH="40" borderRadius="sm" />
            ) : (
              <Chip key={file.path}>
                <Film />
                {file.name}
              </Chip>
            ),
          )}
        </HStack>
      ) : null}
      <HStack gap="xs" color="fg.muted">
        <Icon as={Info} boxSize="icon-xs" />
        <Text textStyle="label/XS">
          {describeMediaRule(channelName, rule)}
          {media.data?.length ? ` Files are in post-media/${threadId}/ in the extension storage folder.` : ""}
        </Text>
      </HStack>
      {media.error ? (
        <Box>
          <Text textStyle="label/XS" color="fg.error">
            {media.error.message}
          </Text>
        </Box>
      ) : null}
    </Stack>
  );
};
