import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, waitFor } from "storybook/test";
import { ScrollArea } from "@/components/primitives/scroll-area";

const items = Array.from({ length: 24 }, (_, index) => `Scrollable row ${index + 1}`);
const layeredItems = Array.from({ length: 16 }, (_, index) => `Layered row ${index + 1}`);

const meta: Meta<typeof ScrollArea> = {
  title: "Components/Layout/Scroll Area",
  component: ScrollArea,
  parameters: {
    docs: {
      description: {
        component: "Shared scrolling surface. The default xs size uses a 2px thumb with an 8px pointer target.",
      },
    },
  },
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

type Story = StoryObj<typeof ScrollArea>;

export const Vertical: Story = {
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
  ...Vertical,
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>('[data-part="viewport"]');
    await expect(viewport).not.toBeNull();
    viewport!.focus();
    await expect(viewport).toHaveFocus();
    await expect(getComputedStyle(viewport!).outlineStyle).toBe("none");
  },
};

export const BothDirections: Story = {
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
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      for (const orientation of ["vertical", "horizontal"]) {
        const scrollbar = canvasElement.querySelector<HTMLElement>(
          `[data-part="scrollbar"][data-orientation="${orientation}"]`,
        )!;
        const bounds = scrollbar.getBoundingClientRect();
        expect(orientation === "vertical" ? bounds.width : bounds.height).toBe(2);
        const point =
          orientation === "vertical"
            ? { x: bounds.right - 7, y: bounds.top + bounds.height / 2 }
            : { x: bounds.left + bounds.width / 2, y: bounds.bottom - 7 };
        const target = canvasElement.ownerDocument.elementFromPoint(point.x, point.y);
        expect(target?.closest('[data-part="scrollbar"]')).toBe(scrollbar);
      }
    });
  },
};

export const LayeredRows: Story = {
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
  render: () => <GrowingNestedScrollAreas />,
};
