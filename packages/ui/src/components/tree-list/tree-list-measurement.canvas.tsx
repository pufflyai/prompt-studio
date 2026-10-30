import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useRef, useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { TreeList } from "./tree-list";

const meta: CanvasMeta<typeof TreeList> = {
  title: "Components/Data Display/Tree List/Measurement",
  component: TreeList,
};
export default meta;
type Story = CanvasVariant<typeof TreeList>;
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
  id: "components-data-display-tree-list-measurement--added-rows",
  render: () => <MeasuredRowsStory />,
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
  id: "components-data-display-tree-list-measurement--hidden-and-shown",
  render: () => <HiddenRowsStory />,
};
