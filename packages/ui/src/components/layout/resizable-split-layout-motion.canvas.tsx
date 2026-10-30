import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { ResizableSplitLayout } from "./resizable-split-layout";
import type { ResizableSplitSide } from "./resizable-split-layout.geometry";

const MotionPanel = (props: { side?: ResizableSplitSide }) => {
  const { side = "right" } = props;
  const [collapsed, setCollapsed] = useState(true);
  return (
    <Stack h="96" gap="sm">
      <Button onClick={() => setCollapsed(!collapsed)}>Toggle panel</Button>
      <ResizableSplitLayout
        resizableSide={side}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        defaultSizePx={240}
        minSizePx={120}
        contentMinSizePx={160}
        resizablePanel={
          <Box h="full" bg="bg.subtle">
            <Text>Saved size content</Text>
          </Box>
        }
        contentPanel={
          <Box>
            <Text>Main content</Text>
          </Box>
        }
      />
    </Stack>
  );
};
const meta = {
  tags: ["motion"],
  title: "Components/Layout/Resizable Split Layout/Motion",
  component: MotionPanel,
  parameters: {
    docs: {
      description: {
        component: "Resize a divider, drag it closed, then reopen. The content should fill the restored panel.",
      },
    },
  },
} satisfies CanvasMeta<typeof MotionPanel>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Right: Story = {
  id: "components-layout-resizable-split-layout-motion--right",
};
export const Left: Story = {
  id: "components-layout-resizable-split-layout-motion--left",
  ...Right,
  args: { side: "left" },
};
export const Bottom: Story = {
  id: "components-layout-resizable-split-layout-motion--bottom",
  ...Right,
  args: { side: "bottom" },
};
export const Top: Story = {
  id: "components-layout-resizable-split-layout-motion--top",
  ...Right,
  args: { side: "top" },
};
