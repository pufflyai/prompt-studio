import { Box, Flex } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { mediaRules } from "../sites";
import { RadarStory, storyIdeas, storyPost, storyThread } from "../webview/story-fixtures";
import { Conversation } from "./conversation";
import { PostInsights, ThreadInsights } from "./insights";
import { NewPostDraft } from "./new-post";

const meta: Meta = {
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
type Story = StoryObj;

export const ThreadMockup: Story = {
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
