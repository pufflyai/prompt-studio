import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { type ConversationFixture, fixtures, fixturesById } from "../mocks/library";
import { ChatPanel } from "./chat-panel";

const fixtureOptions = fixtures.map((f) => f.id);

const meta: Meta<typeof FixtureRenderer> = {
  title: "Chat UI/Conversation Library",
  component: FixtureRenderer,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Real conversation snippets curated from .pstdio-dev sessions. Pick a fixture to preview different tool-call shapes for each harness.",
      },
    },
  },
  argTypes: {
    fixtureId: {
      control: { type: "select" },
      options: fixtureOptions,
      description: "Which curated conversation to render.",
    },
  },
};

export default meta;

type Story = StoryObj<typeof FixtureRenderer>;

interface FixtureRendererProps {
  fixtureId: string;
}

function FixtureRenderer({ fixtureId }: FixtureRendererProps) {
  const fixture = fixturesById.get(fixtureId) ?? fixtures[0];

  return (
    <Stack gap="sm" w="full" maxW="1024px">
      <FixtureHeader fixture={fixture} />
      <Box h="680px" bg="bg" borderWidth="1px" borderColor="border" borderRadius="lg" p="md">
        <ChatPanel
          messages={fixture.messages}
          emptyStateTitle="No active conversations"
          emptyStateDescription="Start a conversation to see messages here."
          chatInputPlaceholder="Type a message..."
        />
      </Box>
    </Stack>
  );
}

interface FixtureHeaderProps {
  fixture: ConversationFixture;
}

function FixtureHeader({ fixture }: FixtureHeaderProps) {
  return (
    <Stack gap="xs">
      <HStack gap="2">
        <Text textStyle="label/S/medium" color="fg.muted">
          {fixture.agent}
        </Text>
        <Text textStyle="label/S/medium">·</Text>
        <Text textStyle="label/S/medium">{fixture.label}</Text>
        <Text textStyle="label/S/medium" color="fg.muted">
          ({fixture.messages.length} messages)
        </Text>
      </HStack>
      <Text textStyle="body/S/regular" color="fg.muted">
        {fixture.description}
      </Text>
    </Stack>
  );
}

export const Library: Story = {
  args: {
    fixtureId: fixtures[0].id,
  },
};
