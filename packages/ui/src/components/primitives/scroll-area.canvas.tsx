import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";

const items = Array.from({ length: 24 }, (_, index) => `Scrollable row ${index + 1}`);
const layeredItems = Array.from({ length: 16 }, (_, index) => `Layered row ${index + 1}`);
const meta: CanvasMeta<typeof ScrollArea> = {
  title: "Components/Layout/Scroll Area",
  component: ScrollArea,
  description: "Shared scrolling surface. The default xs size uses a 2px thumb with an 8px pointer target.",
  decorators: [
    (Story) => (
      <Box bg="bg" maxW="560px" p="lg">
        <Story />
      </Box>
    ),
  ],
  args: {
    maxH: "14rem",
    borderWidth: "1px",
    borderColor: "border.subtle",
    borderRadius: "md",
    contentProps: {
      p: "sm",
      spaceY: "xs",
    },
  },
};
export default meta;
type Story = CanvasFrame<typeof ScrollArea>;
export const Vertical: Story = {
  id: "components-layout-scroll-area--vertical",
  render: (args) => (
    <ScrollArea {...args}>
      {items.map((item) => (
        <Text key={item} textStyle="paragraph/S/regular">
          {item}
        </Text>
      ))}
    </ScrollArea>
  ),
};
export const Focused: Story = {
  id: "components-layout-scroll-area--focused",
  ...Vertical,
};
export const BothDirections: Story = {
  id: "components-layout-scroll-area--both-directions",
  args: {
    showHorizontalScrollbar: true,
    maxW: "24rem",
    contentProps: {
      p: "sm",
      minW: "42rem",
    },
  },
  render: (args) => (
    <ScrollArea {...args}>
      <Stack gap="xs">
        {items.slice(0, 12).map((item) => (
          <Text key={item} textStyle="paragraph/S/regular">
            {item} with extra content to demonstrate horizontal scrolling.
          </Text>
        ))}
      </Stack>
    </ScrollArea>
  ),
};
export const LayeredRows: Story = {
  id: "components-layout-scroll-area--layered-rows",
  args: {
    showHorizontalScrollbar: true,
    maxH: "12rem",
    maxW: "24rem",
    contentProps: {
      minW: "42rem",
    },
  },
  render: (args) => (
    <ScrollArea {...args}>
      <Stack gap="2xs">
        {layeredItems.map((item) => (
          <Box
            key={item}
            data-testid="scroll-area-layered-row"
            position="relative"
            zIndex="1"
            bg="bg"
            borderWidth="1px"
            borderColor="border.subtle"
            px="sm"
            py="xs"
          >
            <Text textStyle="paragraph/S/regular">{item} with enough content to require horizontal scrolling.</Text>
          </Box>
        ))}
      </Stack>
    </ScrollArea>
  ),
};
const GrowingNestedScrollAreas = () => {
  const [rowCount, setRowCount] = useState(24);
  return (
    <Stack gap="sm">
      <Button size="xs" onClick={() => setRowCount((count) => count + 24)}>
        Add rows
      </Button>
      <ScrollArea h="14rem" contentProps={{ p: "sm" }}>
        <Stack gap="sm">
          <ScrollArea h="8rem" showHorizontalScrollbar>
            <Stack minW="42rem" gap="0">
              {Array.from({ length: rowCount }, (_, index) => (
                <Text key={index} textStyle="paragraph/S/regular">
                  Nested row {index + 1} with enough content to scroll in both directions.
                </Text>
              ))}
            </Stack>
          </ScrollArea>
          {items.map((item) => (
            <Text key={item} textStyle="paragraph/S/regular">
              {item}
            </Text>
          ))}
        </Stack>
      </ScrollArea>
    </Stack>
  );
};
export const GrowingNested: Story = {
  id: "components-layout-scroll-area--growing-nested",
  render: () => <GrowingNestedScrollAreas />,
};
