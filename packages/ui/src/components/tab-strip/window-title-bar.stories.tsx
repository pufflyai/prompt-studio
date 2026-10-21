import { Box, HStack, IconButton } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Folder, ListTree, PanelBottom, PanelRight, Plus } from "lucide-react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { WindowTabs } from "./window-tabs";
import { WindowTitleBar } from "./window-title-bar";

const PanelControls = () => {
  const [open, setOpen] = useState(true);
  return (
    <HStack gap="2xs" role="group" aria-label="Panel controls">
      <IconButton
        aria-label="Toggle Sidenav"
        aria-pressed={open}
        variant="ghost"
        size="xs"
        onClick={() => setOpen(!open)}
      >
        <ListTree />
      </IconButton>
      <IconButton aria-label="Toggle Bottom Panel" variant="ghost" size="xs">
        <PanelBottom />
      </IconButton>
      <IconButton aria-label="Toggle Side Panel" variant="ghost" size="xs">
        <PanelRight />
      </IconButton>
    </HStack>
  );
};

const NoPanelControls = () => null;

interface ExampleProps {
  platform?: string;
  tabCount?: number;
  emptyActions?: boolean;
}

const Example = (props: ExampleProps) => {
  const { platform = "darwin", tabCount = 2, emptyActions = false } = props;
  const [tabs, setTabs] = useState(() =>
    Array.from({ length: tabCount }, (_, index) => ({
      id: String(index),
      label: `Project ${index + 1}`,
      icon: <Folder />,
    })),
  );
  const [selectedId, setSelectedId] = useState<string | undefined>("0");
  return (
    <WindowTitleBar platform={platform} actions={emptyActions ? <NoPanelControls /> : <PanelControls />}>
      <WindowTabs
        tabs={tabs}
        selectedId={selectedId}
        aria-label="Project tabs"
        onSelect={setSelectedId}
        onClose={(id) => {
          const remaining = tabs.filter((tab) => tab.id !== id);
          setTabs(remaining);
          if (selectedId === id) setSelectedId(remaining[0]?.id);
        }}
      />
      <IconButton aria-label="Open project" variant="ghost" size="xs">
        <Plus />
      </IconButton>
    </WindowTitleBar>
  );
};

const checkAlignment = async (canvasElement: HTMLElement, overlay: boolean) => {
  const canvas = within(canvasElement);
  const content = canvasElement.querySelector<HTMLElement>(".ps-window-title-bar__content")!;
  const actions = canvasElement.querySelector<HTMLElement>(".ps-window-title-bar__actions")!;
  const padding = Number.parseFloat(getComputedStyle(content).paddingInlineEnd);
  await expect(actions.getBoundingClientRect().right).toBeCloseTo(content.getBoundingClientRect().right - padding, 0);
  await expect(canvas.getByRole("tablist").getBoundingClientRect().right).toBeLessThanOrEqual(
    canvas.getByRole("button", { name: "Open project" }).getBoundingClientRect().left,
  );
  await expect(getComputedStyle(actions, "::after").content).toBe(overlay ? '""' : "none");
  const toggle = canvas.getByRole("button", { name: "Toggle Sidenav" });
  await userEvent.click(toggle);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(canvas.getByRole("button", { name: "Close Project 1" }));
  await expect(canvas.queryByRole("tab", { name: "Project 1" })).not.toBeInTheDocument();
  await expect(actions.getBoundingClientRect().right).toBeCloseTo(content.getBoundingClientRect().right - padding, 0);
};

const meta = {
  title: "Components/Navigation/Window Title Bar",
  component: WindowTitleBar,
  args: { platform: "darwin" },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Place project tabs and their open-project button in children. Use actions for trailing panel controls. The title bar reserves native control bounds and adds a subtle separator before Windows and Linux controls. Empty actions collapse. macOS full screen releases the leading control reservation.",
      },
    },
  },
} satisfies Meta<typeof WindowTitleBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MacOS: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => checkAlignment(canvasElement, false),
};
export const Windows: Story = {
  args: { platform: "win32" },
  render: () => <Example platform="win32" />,
  play: async ({ canvasElement }) => checkAlignment(canvasElement, true),
};
export const Ubuntu: Story = {
  args: { platform: "linux" },
  render: () => <Example platform="linux" />,
  play: async ({ canvasElement }) => checkAlignment(canvasElement, true),
};
export const Overflow: Story = {
  args: { platform: "win32" },
  render: () => (
    <Box maxWidth="2xl">
      <Example platform="win32" tabCount={12} />
    </Box>
  ),
  play: async ({ canvasElement }) => checkAlignment(canvasElement, true),
};
export const FullScreen: Story = {
  render: () => (
    <Box data-window-full-screen="">
      <Example />
    </Box>
  ),
  play: async ({ canvasElement }) => checkAlignment(canvasElement, false),
};
export const EmptyActions: Story = {
  args: { platform: "win32" },
  render: () => <Example platform="win32" emptyActions />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector(".ps-window-title-bar__actions")).not.toBeVisible();
  },
};
export const WindowsDark: Story = { ...Windows, globals: { theme: "pstdio-dark" } };
