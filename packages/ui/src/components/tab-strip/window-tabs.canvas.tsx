import { Box, IconButton } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { BookOpen, Columns3, Folder, PenTool, Plus } from "lucide-react";
import { useState } from "react";
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
        onReorder={(id, targetId) => {
          const reordered = [...tabs];
          const from = reordered.findIndex((tab) => tab.id === id);
          const to = reordered.findIndex((tab) => tab.id === targetId);
          reordered.splice(to, 0, ...reordered.splice(from, 1));
          setTabs(reordered);
        }}
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
          "Native window title-bar tabs. The host owns selection, close behavior, and optional reordering. Drag a tab to the shared insertion line; the preview stays inside the strip and releasing outside cancels the move. Long labels ellipsize at the shared tab limit; crowded tabs shrink before scrolling. Focus a tab and use Alt+ArrowLeft or Alt+ArrowRight to reorder, or press Space, arrow keys, then Space to drop or Escape to cancel. Reordering keeps the selected tab. Native controls occupy the reserved area; stories do not draw them. The desktop host sets data-window-full-screen on the document in macOS full screen to release that space.",
      },
    },
  },
} satisfies CanvasMeta<typeof WindowTabs>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const SeveralTabs: Story = {
  id: "components-navigation-window-tabs--several-tabs",
  render: () => <Example />,
};
export const KeyboardReordering: Story = {
  id: "components-navigation-window-tabs--keyboard-reordering",
  render: () => <Example />,
};
export const PointerReordering: Story = {
  id: "components-navigation-window-tabs--pointer-reordering",
  render: () => <Example />,
};
export const DropOutside: Story = {
  id: "components-navigation-window-tabs--drop-outside",
  render: () => <Example />,
};
export const FullScreen: Story = {
  id: "components-navigation-window-tabs--full-screen",
  render: () => (
    <Box data-window-full-screen="">
      <Example />
    </Box>
  ),
};
export const FullScreenDark: Story = {
  id: "components-navigation-window-tabs--full-screen-dark",
  ...FullScreen,
  globals: { theme: "pstdio-dark" },
};
export const OneTab: Story = {
  id: "components-navigation-window-tabs--one-tab",
  render: () => <Example initialTabs={projects.slice(0, 1)} />,
};
export const Overflow: Story = {
  id: "components-navigation-window-tabs--overflow",
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
export const OverflowDropOutside: Story = {
  id: "components-navigation-window-tabs--overflow-drop-outside",
  ...Overflow,
};
export const LongNames: Story = {
  id: "components-navigation-window-tabs--long-names",
  render: () => (
    <Example
      initialTabs={[
        { id: "long", label: "Prompt Studio research and documentation for the desktop release", icon: <BookOpen /> },
        ...projects,
      ]}
    />
  ),
};
export const Dark: Story = {
  id: "components-navigation-window-tabs--dark",
  render: () => <Example />,
  globals: { theme: "pstdio-dark" },
};
export const Light: Story = {
  id: "components-navigation-window-tabs--light",
  render: () => <Example />,
  globals: { theme: "pstdio-light" },
};
export const NativeOverlay: Story = {
  id: "components-navigation-window-tabs--native-overlay",
  render: () => <Example platform="win32" />,
};
export const CloseHover: Story = {
  id: "components-navigation-window-tabs--close-hover",
  render: () => <Example />,
};
export const CloseFocus: Story = {
  id: "components-navigation-window-tabs--close-focus",
  render: () => <Example />,
};
export const KeyboardSelection: Story = {
  id: "components-navigation-window-tabs--keyboard-selection",
  render: () => <Example />,
};
export const Crowded: Story = {
  id: "components-navigation-window-tabs--crowded",
  render: () => (
    <Box maxWidth="2xl">
      <Example
        initialTabs={[
          ...projects,
          { id: "research", label: "Research and documentation", icon: <Folder /> },
          { id: "notes", label: "Notes", icon: <BookOpen /> },
        ]}
      />
    </Box>
  ),
};
