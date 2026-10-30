import { Button, Input, Stack } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { BubbleButton } from "./bubble-button";
import { BubblePanel } from "./bubble-panel";

const FloatingPanel = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(!open)}>Toggle floating panel</Button>
      <BubbleButton isOpen={open} aria-label="Open Side Panel" onClick={() => setOpen(true)}>
        <MessageCircle />
      </BubbleButton>
      <BubblePanel isOpen={open} title="Side Panel" closeLabel="Minimize" onClose={() => setOpen(false)}>
        <Stack p="sm">
          <Input aria-label="Draft" placeholder="A draft stays here when minimized" />
        </Stack>
      </BubblePanel>
    </>
  );
};
const meta = {
  title: "Components/Overlays/Bubble/Motion",
  component: FloatingPanel,
  fullscreen: true,
} satisfies CanvasMeta<typeof FloatingPanel>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const LauncherAndPanel: Story = {
  id: "components-overlays-bubble-motion--launcher-and-panel",
};
