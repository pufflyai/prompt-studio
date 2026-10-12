import { Button, Input, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { BubbleButton } from "./bubble-button";
import { BubblePanel } from "./bubble-panel";

interface FloatingPanelProps {
  showHeader?: boolean;
}

const FloatingPanel = (props: FloatingPanelProps) => {
  const { showHeader } = props;
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(!open)}>Toggle floating panel</Button>
      <BubbleButton isOpen={open} aria-label="Open Side Panel" onClick={() => setOpen(true)}>
        <MessageCircle />
      </BubbleButton>
      <BubblePanel
        isOpen={open}
        title="Side Panel"
        showHeader={showHeader}
        closeLabel="Minimize"
        onClose={() => setOpen(false)}
      >
        <Stack p="sm">
          <Input aria-label="Draft" placeholder="A draft stays here when minimized" />
        </Stack>
      </BubblePanel>
    </>
  );
};
const meta = {
  tags: ["motion"],
  title: "Components/Overlays/Bubble/Motion",
  component: FloatingPanel,
  args: { showHeader: true },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FloatingPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const LauncherAndPanel: Story = {
  play: async () => {
    const canvas = within(document.body);
    await userEvent.click(canvas.getByRole("button", { name: "Open Side Panel" }));
    await waitFor(() => expect(canvas.getByRole("dialog", { name: "Side Panel" })).toBeVisible());
    const panel = canvas.getByRole("dialog", { name: "Side Panel" });
    const draft = canvas.getByRole("textbox", { name: "Draft" });
    await userEvent.type(draft, "Keep this draft");
    await userEvent.click(canvas.getByRole("button", { name: "Minimize" }));
    await expect(panel).toHaveAttribute("inert");
    await expect(draft).toBeVisible();
    await waitFor(() => expect(draft).not.toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Open Side Panel" }));
    await expect(draft).toHaveValue("Keep this draft");
  },
};
