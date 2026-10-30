import { Box, Flex } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { mediaRules } from "../sites";
import { RadarStory, storyIdeas, storyPost, storyThread } from "../webview/story-fixtures";
import { Conversation } from "./conversation";
import { PostInsights, ThreadInsights } from "./insights";
import { NewPostDraft } from "./new-post";

const meta: CanvasMeta = {
  title: "Extensions/Social radar/Thread",
  decorators: [
    (Story) => (
      <RadarStory>
        <Box p="lg">
          <Story />
        </Box>
      </RadarStory>
    ),
  ],
};
export default meta;
type Story = CanvasVariant;
export const ThreadMockup: Story = {
  id: "extensions-social-radar-thread--thread-mockup",
  render: () => (
    <Flex gap="lg">
      <Box flex="1" maxW="3xl">
        <Conversation thread={storyThread} ideas={storyIdeas} onEditIdea={() => {}} onIdeaStatus={() => {}} />
      </Box>
      <Box w="sm">
        <ThreadInsights thread={storyThread} />
      </Box>
    </Flex>
  ),
};
export const NewPost: Story = {
  id: "extensions-social-radar-thread--new-post",
  render: () => (
    <Flex gap="lg">
      <Box flex="1" maxW="3xl">
        <NewPostDraft
          post={storyPost}
          channelName="X"
          mediaRule={mediaRules.x}
          onEdit={() => {}}
          onDismiss={() => {}}
          onPosted={() => {}}
        />
      </Box>
      <Box w="sm">
        <PostInsights post={storyPost} sourceTitles={{ "thread-1": storyThread.title }} onOpenSource={() => {}} />
      </Box>
    </Flex>
  ),
};
