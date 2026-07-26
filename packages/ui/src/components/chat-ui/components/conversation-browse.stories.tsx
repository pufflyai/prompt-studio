import { Box, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ConversationBrowse, type ConversationBrowseItem } from "./conversation-browse";

const items: ConversationBrowseItem[] = [
  { id: "1", message: "What's left on PS-51?", reply: "The input hover border only — one token in the input recipe." },
  {
    id: "2",
    message: "Do it and show me the diff.",
    reply: "Done — one line in packages/ui/src/theme/recipes/input.ts.",
  },
  {
    id: "3",
    message: "Now migrate the dark tokens too.",
    reply: "Synced the dark neutral scale to the .pen variables.",
  },
  {
    id: "4",
    message: "Wire the model menu into the composer.",
    reply: "Moved it into the input toolbar next to attach and send.",
  },
  {
    id: "5",
    message: "The workspace selector should live in the hub.",
    reply: "Relocated it to the hub header identity slot.",
  },
  {
    id: "6",
    message: "Add the conversation scrubber.",
    reply: "Added the tick rail with a proximity lens and hover cards.",
  },
  { id: "7", message: "Ship it once validation passes." },
];

const meta: Meta<typeof ConversationBrowse> = {
  title: "Patterns/Chat/Conversation Browse",
  component: ConversationBrowse,
  parameters: { layout: "centered" },
};

export default meta;

type Story = StoryObj<typeof ConversationBrowse>;

export const Gutter: Story = {
  render: () => (
    <Box h="360px" display="flex" alignItems="center">
      <ConversationBrowse items={items} onSelect={(id) => console.log("scroll to", id)} />
    </Box>
  ),
};

export const ClippedContainer: Story = {
  render: () => (
    <Box w="10" h="360px" display="flex" alignItems="center" overflow="hidden">
      <ConversationBrowse items={items} onSelect={(id) => console.log("scroll to", id)} />
    </Box>
  ),
};

export const Floating: Story = {
  render: () => (
    <Box position="relative" w="360px" h="360px" bg="bg" borderWidth="1px" borderColor="border" borderRadius="lg" p="3">
      <Stack gap="3">
        {items.map((item) => (
          <Text key={item.id} textStyle="label/S/regular" color="fg" pl="10">
            {item.message}
          </Text>
        ))}
      </Stack>
      <Box position="absolute" top="3" bottom="3" left="3" display="flex" alignItems="center">
        <ConversationBrowse items={items} floating onSelect={(id) => console.log("scroll to", id)} />
      </Box>
    </Box>
  ),
};
