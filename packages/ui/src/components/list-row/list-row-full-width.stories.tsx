import { Box, HStack, Kbd, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Check, FileText, Folder } from "lucide-react";
import { ListRow } from "./list-row";

const meta: Meta<typeof ListRow> = {
  title: "Components/Data Display/List Row/Full Width",
  component: ListRow,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof ListRow>;

export const OverlayRows: Story = {
  render: () => (
    <Box maxW="32rem" borderWidth="1px" borderColor="border.subtle" overflow="hidden">
      <Stack gap="0">
        <ListRow
          variant="full-width"
          id="palette-entry"
          label="Open command palette"
          description="Global commands"
          icon={<FileText size={14} />}
          endContent={
            <HStack gap="2xs">
              <Kbd size="sm">mod</Kbd>
              <Kbd size="sm">K</Kbd>
            </HStack>
          }
          isSelected
        />
        <ListRow
          variant="full-width"
          id="project-entry"
          label="Prompt Studio"
          description="/Users/au-re/Documents/Projects/prompt-studio"
          icon={<Folder size={14} />}
          endContent={<Check size={14} />}
        />
      </Stack>
    </Box>
  ),
};
