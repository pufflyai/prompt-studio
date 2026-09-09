import { Badge, Box, HStack, Input, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Bot, Shapes } from "lucide-react";
import { useState } from "react";
import { ListRow } from "@/components/list-row/list-row";
import { Switch } from "@/components/primitives/switch";

const SharedFeatures = () => {
  const story = useSlotRecipe({ key: "landingStory" })({});
  const [enabled, setEnabled] = useState(true);
  return (
    <Box css={story.page}>
      <Stack gap="sm">
        <Text as="h1" textStyle="heading/M">
          The plumbing, included.
        </Text>
        <Text color="fg.muted">Shared features that every tool can use.</Text>
      </Stack>
      <Box css={story.section}>
        <Text as="h2" textStyle="heading/S">
          Search
        </Text>
        <Box css={story.visual}>
          <Box css={story.panel}>
            <Box css={story.panelHeader}>
              <Input aria-label="Search tools" placeholder="Search tools, files, and commands…" variant="borderless" />
            </Box>
            <Box css={story.panelBody}>
              <ListRow
                label="Icon set editor"
                icon={<Shapes size={16} />}
                isSelected
                endContent={<Badge>Tool</Badge>}
              />
              <ListRow label="Coding agent dashboard" icon={<Bot size={16} />} endContent={<Badge>Tool</Badge>} />
            </Box>
          </Box>
        </Box>
      </Box>
      <Box css={story.section}>
        <Text as="h2" textStyle="heading/S">
          Extension management
        </Text>
        <Box css={story.visual}>
          <Box css={story.panel}>
            <Box css={story.panelHeader}>Installed extensions</Box>
            <HStack css={story.panelBody} flexDirection="row">
              <Shapes size={24} />
              <Stack flex="1" gap="xs">
                <Text textStyle="label/M/medium">Icon set editor</Text>
                <Text textStyle="paragraph/S/regular" color="fg.muted">
                  Browse, edit, and export your icons
                </Text>
              </Stack>
              <Switch
                aria-label="Enable icon set editor"
                checked={enabled}
                onCheckedChange={({ checked }) => setEnabled(checked)}
              />
            </HStack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const meta = {
  title: "Theme/Landing Services",
  component: SharedFeatures,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SharedFeatures>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Desktop: Story = {};
export const NarrowPanel: Story = {
  decorators: [
    (Story) => (
      <Box width="80">
        <Story />
      </Box>
    ),
  ],
};
