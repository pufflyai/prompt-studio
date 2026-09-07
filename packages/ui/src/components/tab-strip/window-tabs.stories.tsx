import { Box, IconButton } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BookOpen, Columns3, Folder, PenTool, Plus } from "lucide-react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { type WindowTab, WindowTabs } from "./window-tabs";
import { WindowTitleBar } from "./window-title-bar";

const projects = [
  { id: "docs", label: "Docs", icon: <BookOpen /> },
  { id: "kanban", label: "Agentic kanban", icon: <Columns3 /> },
  { id: "design", label: "Agentic design", icon: <PenTool /> },
];

const Example = (props: { initialTabs?: WindowTab[]; platform?: string }) => {
  const { initialTabs = projects, platform = "darwin" } = props;
  const [tabs, setTabs] = useState(initialTabs);
  const [selectedId, setSelectedId] = useState(tabs[0]?.id);
  return (
    <WindowTitleBar platform={platform}>
      <WindowTabs
        tabs={tabs}
        selectedId={selectedId}
        aria-label="Project tabs"
        onSelect={setSelectedId}
        onClose={(id) => {
          const index = tabs.findIndex((tab) => tab.id === id);
          const remaining = tabs.filter((tab) => tab.id !== id);
          setTabs(remaining);
          if (selectedId === id) setSelectedId(remaining[Math.min(index, remaining.length - 1)]?.id);
        }}
      />
      <IconButton aria-label="Open project" variant="ghost" size="xs">
        <Plus />
      </IconButton>
    </WindowTitleBar>
  );
};

const meta = {
  title: "Components/Navigation/Window Tabs",
  component: WindowTabs,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Native window title-bar tabs. The host owns selection and close behavior. Native controls occupy the reserved area; stories do not draw them.",
      },
    },
  },
} satisfies Meta<typeof WindowTabs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SeveralTabs: Story = { render: () => <Example /> };
export const OneTab: Story = { render: () => <Example initialTabs={projects.slice(0, 1)} /> };
export const Overflow: Story = {
  render: () => (
    <Box maxWidth="2xl">
      <Example
        initialTabs={Array.from({ length: 12 }, (_, index) => ({
          id: String(index),
          label: `Research project ${index + 1}`,
          icon: <Folder />,
        }))}
      />
    </Box>
  ),
};
export const LongNames: Story = {
  render: () => (
    <Example
      initialTabs={[
        { id: "long", label: "Prompt Studio research and documentation for the desktop release", icon: <BookOpen /> },
        ...projects,
      ]}
    />
  ),
};
export const Dark: Story = { render: () => <Example />, globals: { theme: "pstdio-dark" } };
export const Light: Story = { render: () => <Example />, globals: { theme: "pstdio-light" } };
export const NativeOverlay: Story = { render: () => <Example platform="win32" /> };
export const CloseHover: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole("button", { name: "Close Docs" }));
  },
};
export const CloseFocus: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("tab", { name: "Docs" }).focus();
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Close Docs" })).toHaveFocus();
  },
};
export const KeyboardSelection: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("tab", { name: "Docs" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("tab", { name: "Agentic kanban" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Delete}");
    await expect(canvas.getByRole("tab", { name: "Agentic design" })).toHaveAttribute("aria-selected", "true");
  },
};
