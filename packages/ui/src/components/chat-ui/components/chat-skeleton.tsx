import { Skeleton, Stack } from "@chakra-ui/react";
import { ChatMessage } from "./ai-message";

const SkeletonLines = (props: { widths: string[] }) => {
  const { widths } = props;

  return (
    <Stack gap="xs" w="full">
      {widths.map((width, index) => (
        <Skeleton key={`${width}-${index}`} height="3" width={width} borderRadius="xs" />
      ))}
    </Stack>
  );
};

export const ChatSkeleton = () => {
  return (
    <Stack minH="full" py="xs" gap="0">
      <ChatMessage.Root from="user">
        <ChatMessage.Content from="user">
          <SkeletonLines widths={["72%", "46%"]} />
        </ChatMessage.Content>
      </ChatMessage.Root>
      <ChatMessage.Root from="assistant">
        <ChatMessage.Content from="assistant">
          <SkeletonLines widths={["76%", "62%", "40%"]} />
        </ChatMessage.Content>
      </ChatMessage.Root>
    </Stack>
  );
};
