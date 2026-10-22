import { Box, Button, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useRef, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Tooltip } from "./tooltip";

const meta = {
  title: "Components/Overlays/Tooltip",
  component: Tooltip,
  parameters: {
    docs: {
      description: {
        component:
          "Tooltips wait 680 ms on the first hover. Pass overflowRef for a label tooltip that is useful only when its text is clipped. The tooltip updates when the label or its available width changes. Keyboard focus uses the shared tooltip behavior.",
      },
    },
  },
} satisfies Meta<typeof Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { content: "Reasoning effort", children: <Button>High</Button> },
};

// ResizeObserver must finish measuring before the next synthetic pointer event.
const waitForLayout = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

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
  args: { content: "Session notes for review" },
  render: () => <ResizingLabel />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const tab = canvas.getByRole("tab");
    const waitForClipping = async (clipped: boolean) => {
      // Width changes animate; wait for the visible label before moving the synthetic pointer.
      await waitFor(() => {
        const label = tab.querySelector("span")!;
        expect(label.scrollWidth > label.clientWidth).toBe(clipped);
      });
      await waitForLayout();
    };
    await waitForClipping(true);
    await userEvent.hover(tab);
    await expect(await page.findByRole("tooltip")).toHaveTextContent("Session notes for review");
    await userEvent.unhover(tab);
    await userEvent.click(canvas.getByRole("button", { name: "Toggle width" }));
    await waitForClipping(false);
    tab.focus();
    await userEvent.hover(tab);
    await waitFor(() => expect(page.queryByRole("tooltip")).toBeNull());
    await userEvent.unhover(tab);
    await userEvent.click(canvas.getByRole("button", { name: "Toggle width" }));
    await waitForClipping(true);
    await userEvent.hover(tab);
    await expect(await page.findByRole("tooltip")).toHaveTextContent("Session notes for review");
    await userEvent.unhover(tab);
    await userEvent.click(canvas.getByRole("button", { name: "Rename" }));
    await waitForClipping(false);
    await userEvent.hover(tab);
    await waitFor(() => expect(page.queryByRole("tooltip")).toBeNull());
    await userEvent.unhover(tab);
    await userEvent.click(canvas.getByRole("button", { name: "Toggle tooltips" }));
    await userEvent.click(canvas.getByRole("button", { name: "Rename" }));
    await waitForClipping(true);
    await userEvent.hover(tab);
    await waitFor(() => expect(page.queryByRole("tooltip")).toBeNull());
    await userEvent.unhover(tab);
    await userEvent.click(canvas.getByRole("button", { name: "Toggle width" }));
    await userEvent.click(canvas.getByRole("button", { name: "Toggle tooltips" }));
    await waitForClipping(false);
    await userEvent.hover(tab);
    await waitFor(() => expect(page.queryByRole("tooltip")).toBeNull());
    await userEvent.unhover(tab);
    await userEvent.click(canvas.getByRole("button", { name: "Toggle width" }));
    await waitForClipping(true);
    await userEvent.hover(tab);
    await expect(await page.findByRole("tooltip")).toHaveTextContent("Session notes for review");
  },
};
