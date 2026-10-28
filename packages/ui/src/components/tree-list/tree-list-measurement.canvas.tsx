import { Box, Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useRef, useState } from "react";
import { expect, spyOn, userEvent, waitFor, within } from "storybook/test";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { TreeList } from "./tree-list";

const meta: Meta<typeof TreeList> = {
  title: "Components/Data Display/Tree List/Measurement",
  component: TreeList,
};

export default meta;
type Story = StoryObj<typeof TreeList>;

const MeasuredRowsStory = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);

  return (
    <Stack w="80" gap="sm">
      <Button onClick={() => setCount(100)}>Add sessions</Button>
      <ScrollArea height="64" viewportRef={scrollRef}>
        <TreeList
          virtualize
          scrollRef={scrollRef}
          rowVariant="compact"
          expandedSectionIds={["sessions"]}
          sections={[
            {
              id: "sessions",
              label: "Sessions",
              nodes: Array.from({ length: count }, (_, index) => ({
                id: `session-${index}`,
                label: `Session ${index + 1}`,
                isNavigable: true,
              })),
            },
          ]}
        />
      </ScrollArea>
    </Stack>
  );
};

export const AddedRows: Story = {
  tags: ["measurement-regression"],
  render: () => <MeasuredRowsStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const errors = spyOn(console, "error");
    try {
      await userEvent.click(canvas.getByRole("button", { name: "Add sessions" }));
      await waitFor(() =>
        expect(canvasElement.querySelector<HTMLElement>('[data-tree-list-focus-id="session-0"]')!).toBeVisible(),
      );
      const first = canvasElement.querySelector<HTMLElement>('[data-tree-list-focus-id="session-0"]')!;
      await userEvent.click(first);
      await userEvent.keyboard("{End}");
      await waitFor(() =>
        expect(canvasElement.querySelector<HTMLElement>('[data-tree-list-focus-id="session-99"]')!).toHaveFocus(),
      );
      await userEvent.keyboard("{Home}");
      await waitFor(() =>
        expect(canvasElement.querySelector<HTMLElement>('[data-tree-list-focus-id="header:sessions"]')!).toHaveFocus(),
      );
      expect(errors.mock.calls.filter((args) => args.some((arg) => String(arg).includes("flushSync")))).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  },
};

const rowIds = Array.from({ length: 12 }, (_, index) => `row-${index}`);

// Retained workbench panels hide with display: none, so a virtual list must survive having no size.
const HiddenRowsStory = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  return (
    <Stack w="80" gap="sm">
      <Button onClick={() => setHidden((value) => !value)}>{hidden ? "Show list" : "Hide list"}</Button>
      <Box display={hidden ? "none" : "block"}>
        <ScrollArea height="96" viewportRef={scrollRef}>
          <TreeList
            virtualize
            scrollRef={scrollRef}
            rowVariant="compact"
            expandedSectionIds={["channels"]}
            sections={[
              {
                id: "channels",
                label: "Channels",
                nodes: rowIds.map((id, index) => ({ id, label: `Channel ${index + 1}`, isNavigable: true })),
              },
            ]}
          />
        </ScrollArea>
      </Box>
    </Stack>
  );
};

export const HiddenAndShown: Story = {
  tags: ["measurement-regression"],
  render: () => <HiddenRowsStory />,
};
