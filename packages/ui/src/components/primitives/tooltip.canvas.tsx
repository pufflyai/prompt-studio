import { Box, Button, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useRef, useState } from "react";
import { Tooltip } from "./tooltip";

const meta = {
  title: "Components/Overlays/Tooltip",
  component: Tooltip,
  description:
    "Tooltips wait 380 ms on the first hover. Pass overflowRef for a label tooltip that is useful only when its text is clipped. The tooltip updates when the label or its available width changes. Keyboard focus uses the shared tooltip behavior.",
} satisfies CanvasMeta<typeof Tooltip>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Default: Story = {
  id: "components-overlays-tooltip--default",
  args: { content: "Reasoning effort", children: <Button>High</Button> },
};
// ResizeObserver must finish measuring before the next synthetic pointer event.
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
export const TruncatedLabel: Story = {
  id: "components-overlays-tooltip--truncated-label",
  args: { content: "Session notes for review" },
  render: () => <ResizingLabel />,
};
