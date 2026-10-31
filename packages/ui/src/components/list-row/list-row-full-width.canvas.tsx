import { Box, HStack, Kbd, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Check, FileText, Folder } from "lucide-react";
import { ListRow } from "./list-row";

const meta: CanvasMeta<typeof ListRow> = {
  title: "Components/Data Display/List Row/Full Width",
  component: ListRow,
};
export default meta;
type Story = CanvasFrame<typeof ListRow>;
export const OverlayRows: Story = {
  id: "components-data-display-list-row-full-width--overlay-rows",
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
            <HStack gap="shortcut-key-gap">
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
