import { Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Ideas, Threads } from "./digest-sections";
import type { Thread } from "./schemas";

const thread: Thread = {
  id: "thread-1",
  runId: "run-1",
  site: "hn",
  url: "https://news.ycombinator.com/item?id=42",
  title: "How do you keep several coding agents organized?",
  excerpt: "I keep losing the context between tools.",
  topic: "manage several coding agents",
  intent: "asking-for-tool",
  relevance: 3,
  reason: "A direct request for a workbench.",
  draftReply: "A shared workspace helps keep each task and its agent together.",
  status: "new",
  foundAt: "2026-09-27T07:00:00Z",
};
const meta: Meta<typeof Threads> = {
  title: "Extensions/Social radar/Digest",
  component: Threads,
  args: { threads: [thread], onStatus: () => {} },
  decorators: [
    (Story) => (
      <Stack p="md">
        <Story />
      </Stack>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Threads>;
export const DailyThreads: Story = {};
export const PostIdeas: Story = {
  render: () => (
    <Ideas
      onStatus={() => {}}
      ideas={[
        {
          id: "idea-1",
          runId: "run-1",
          kind: "demo",
          title: "Show the daily research tool",
          body: "I built a tool that finds useful conversations and drafts replies.\n\nI choose what to post.",
          sites: ["x", "linkedin"],
          tags: ["#BuildInPublic"],
          basedOn: ["abc123: add Social radar"],
          status: "new",
          createdAt: "2026-09-27T07:00:00Z",
        },
      ]}
    />
  ),
};
export const PostedHistory: Story = {
  args: {
    posted: true,
    threads: [
      {
        ...thread,
        status: "posted",
        postedAt: "2026-09-27T08:00:00Z",
        outcome: "Three replies; the author thanked you.",
      },
    ],
  },
};
export const Empty: Story = { args: { threads: [] } };
