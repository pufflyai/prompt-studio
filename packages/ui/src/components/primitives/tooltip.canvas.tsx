import { Box, Button, Text, VStack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useRef, useState } from "react";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";
import { Tooltip } from "./tooltip";

const meta = {
  title: "Design system/Components/Overlays/Tooltip",
  component: Tooltip,
  description:
    "Tooltips wait 380 ms on the first hover. Pass overflowRef for a label tooltip that is useful only when its text is clipped. The tooltip updates when the label or its available width changes. Keyboard focus uses the shared tooltip behavior.",
} satisfies CanvasMeta<typeof Tooltip>;
export default {
  title: "Design system/Components/Overlays/Tooltip",
  description:
    "Tooltips wait 380 ms on the first hover. Pass overflowRef for a label tooltip that is useful only when its text is clipped. The tooltip updates when the label or its available width changes. Keyboard focus uses the shared tooltip behavior.",
  fullscreen: true,
};
type Story = CanvasFrame<typeof meta>;
const Default: Story = {
  id: "components-overlays-tooltip--default",
  args: { content: "Reasoning effort", children: <Button>High</Button> },
};
const ResizingLabel = () => {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [narrow, setNarrow] = useState(true);
  const [label, setLabel] = useState("Session notes for review");
  const [disabled, setDisabled] = useState(false);
  return (
    <Box>
      <Tooltip content={label} overflowRef={labelRef} disabled={disabled}>
        <Button role="tab" aria-label={label} width={narrow ? "24" : "md"}>
          <Text asChild truncate>
            <span ref={labelRef}>{label}</span>
          </Text>
        </Button>
      </Tooltip>
      <Button onClick={() => setNarrow(!narrow)}>Toggle width</Button>
      <Button onClick={() => setLabel(label === "Notes" ? "Session notes for review" : "Notes")}>Rename</Button>
      <Button onClick={() => setDisabled(!disabled)}>Toggle tooltips</Button>
    </Box>
  );
};
const TruncatedLabel: Story = {
  id: "components-overlays-tooltip--truncated-label",
  args: { content: "Session notes for review" },
  render: () => <ResizingLabel />,
};

const NearbyAction = () => {
  const [completed, setCompleted] = useState(false);
  return (
    <VStack align="start" gap="2">
      <Tooltip open content="This explains the control" positioning={{ placement: "bottom-start" }}>
        <Button>Control explanation</Button>
      </Tooltip>
      <Button onClick={() => setCompleted(true)}>{completed ? "Action completed" : "Nearby action"}</Button>
    </VStack>
  );
};

const PointerThrough: Story = {
  id: "components-overlays-tooltip--pointer-through",
  description: "A noninteractive tooltip explains a control without blocking nearby actions underneath it.",
  args: { content: "This explains the control" },
  render: () => <NearbyAction />,
};

const InteractiveAction = () => {
  const [completed, setCompleted] = useState(false);
  return (
    <Tooltip
      open
      interactive
      content={
        <Button onClick={() => setCompleted(true)}>{completed ? "Tooltip action completed" : "Tooltip action"}</Button>
      }
    >
      <Button>Interactive explanation</Button>
    </Tooltip>
  );
};

const Interactive: Story = {
  id: "components-overlays-tooltip--interactive",
  args: { content: "Interactive explanation" },
  render: () => <InteractiveAction />,
};

const Examples = createCanvasExampleNavigator(meta, { Default, TruncatedLabel, PointerThrough, Interactive });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Default };
