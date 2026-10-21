import { Box, IconButton } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BookOpen, Columns3, Folder, PenTool, Plus } from "lucide-react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
} satisfies Meta<typeof WindowTabs>;
export default meta;
type Story = StoryObj<typeof meta>;

const expectOpenProjectAfterTabs = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const last = canvas.getAllByRole("tab").at(-1)!.closest(".ps-window-tabs__tab")!;
  const button = canvas.getByRole("button", { name: "Open project" });
  const gap = Number.parseFloat(getComputedStyle(button.parentElement!).columnGap);
  await expect(button.getBoundingClientRect().left - last.getBoundingClientRect().right).toBeCloseTo(gap, 1);
};

export const SeveralTabs: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    await expectOpenProjectAfterTabs(canvasElement);
    const tabs = within(canvasElement).getAllByRole("tab");
    for (const tab of tabs) await expect(tab.closest(".ps-window-tabs__tab")).toHaveStyle({ borderWidth: "0px" });
    await userEvent.click(tabs[1]);
    await expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    for (const tab of tabs) await expect(tab.closest(".ps-window-tabs__tab")).toHaveStyle({ borderWidth: "0px" });
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Close Agentic design" }));
    await expectOpenProjectAfterTabs(canvasElement);
  },
};
export const KeyboardReordering: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const docs = canvas.getByRole("tab", { name: "Docs" });
    docs.focus();
    await userEvent.keyboard(" {ArrowRight} ");
    await expect(canvas.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Agentic kanban",
      "Docs",
      "Agentic design",
    ]);
    await expect(docs).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard(" {ArrowRight}{Escape}");
    await expect(canvas.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Agentic kanban",
      "Docs",
      "Agentic design",
    ]);
    await expect(docs).not.toHaveAttribute("aria-pressed", "true");
    await userEvent.keyboard(" {ArrowLeft} ");
    await expect(canvas.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Docs",
      "Agentic kanban",
      "Agentic design",
    ]);
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await expect(canvas.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Agentic kanban",
      "Docs",
      "Agentic design",
    ]);
    await expect(docs).toHaveAttribute("aria-selected", "true");
  },
};
export const PointerReordering: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const docs = canvas.getByRole("tab", { name: "Docs" });
    const target = canvas.getByRole("tab", { name: "Agentic design" });
    const start = docs.getBoundingClientRect();
    const end = target.getBoundingClientRect();
    const origin = { x: start.left + start.width / 2, y: start.top + start.height / 2 };
    const destination = { x: end.right - 4, y: origin.y };
    const user = userEvent.setup();
    await user.pointer([
      { keys: "[MouseLeft>]", target: docs, coords: origin },
      { target: docs, coords: { ...origin, x: origin.x + 8 } },
      { target, coords: destination },
    ]);
    await waitFor(() => expect(canvasElement.querySelector('[data-window-tab-drop="after"]')).toBeVisible());
    await expect(docs.getBoundingClientRect().left).toBe(start.left);
    await user.pointer({ keys: "[/MouseLeft]", target, coords: destination });
    await waitFor(() =>
      expect(canvas.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
        "Agentic kanban",
        "Agentic design",
        "Docs",
      ]),
    );
    await expect(docs).toHaveAttribute("aria-selected", "true");
    const current = docs.getBoundingClientRect();
    const first = canvas.getByRole("tab", { name: "Agentic kanban" });
    const firstRect = first.getBoundingClientRect();
    const back = { x: firstRect.left + firstRect.width / 2, y: origin.y };
    await user.pointer([
      { keys: "[MouseLeft>]", target: docs, coords: { x: current.left + current.width / 2, y: origin.y } },
      { target: docs, coords: { x: current.left + current.width / 2 - 8, y: origin.y } },
      { target: first, coords: back },
    ]);
    await waitFor(() => expect(canvasElement.querySelector('[data-window-tab-drop="before"]')).toBeVisible());
    await user.pointer({ keys: "[/MouseLeft]", target: first, coords: back });
    await waitFor(() =>
      expect(canvas.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
        "Docs",
        "Agentic kanban",
        "Agentic design",
      ]),
    );
  },
};

export const DropOutside: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const docs = canvas.getByRole("tab", { name: "Docs" });
    const start = docs.getBoundingClientRect();
    const origin = { x: start.left + start.width / 2, y: start.top + start.height / 2 };
    const outside = { x: canvasElement.getBoundingClientRect().right - 10, y: origin.y };
    const user = userEvent.setup();
    await user.pointer([
      { keys: "[MouseLeft>]", target: docs, coords: origin },
      { target: docs, coords: { ...origin, x: origin.x + 8 } },
      { target: canvasElement, coords: outside },
    ]);
    await expect(docs.getBoundingClientRect().left).toBe(start.left);
    await expect(canvasElement.querySelector("[data-window-tab-drop]")).toBeNull();
    await user.pointer({ keys: "[/MouseLeft]", target: canvasElement, coords: outside });
    await expect(canvas.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Docs",
      "Agentic kanban",
      "Agentic design",
    ]);
  },
};
export const FullScreen: Story = {
  render: () => (
    <Box data-window-full-screen="">
      <Example />
    </Box>
  ),
};
export const FullScreenDark: Story = {
  ...FullScreen,
  globals: { theme: "pstdio-dark" },
};
export const OneTab: Story = {
  render: () => <Example initialTabs={projects.slice(0, 1)} />,
  play: async ({ canvasElement }) => expectOpenProjectAfterTabs(canvasElement),
};
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole("tab");
    const viewport = canvasElement.querySelector<HTMLElement>('[data-scope="scroll-area"][data-part="viewport"]')!;
    await expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
    await expect(viewport.scrollHeight).toBe(viewport.clientHeight);
    tabs[0].focus();
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(viewport.scrollLeft).toBeGreaterThan(0));
    await expect(tabs.at(-1)).toHaveAttribute("aria-selected", "true");
    const close = canvas.getAllByRole("button", { name: /^Close / }).at(-1)!;
    await expect(close.getBoundingClientRect().right).toBeLessThanOrEqual(viewport.getBoundingClientRect().right);
  },
};
export const OverflowDropOutside: Story = {
  ...Overflow,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole("tab");
    const original = tabs.map((tab) => tab.textContent);
    const viewport = canvasElement.querySelector<HTMLElement>('[data-scope="scroll-area"][data-part="viewport"]')!;
    const start = tabs[2].getBoundingClientRect();
    const bounds = viewport.getBoundingClientRect();
    const origin = { x: start.left + start.width / 2, y: start.top + start.height / 2 };
    const outside = { x: bounds.right + 24, y: origin.y };
    const user = userEvent.setup();
    await user.pointer([
      { keys: "[MouseLeft>]", target: tabs[2], coords: origin },
      { target: tabs[2], coords: { ...origin, x: origin.x + 8 } },
      { target: canvas.getByRole("button", { name: "Open project" }), coords: outside },
    ]);
    await expect(canvasElement.querySelector("[data-window-tab-drop]")).toBeNull();
    await user.pointer({ keys: "[/MouseLeft]", target: canvasElement, coords: outside });
    await expect(canvas.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(original);
  },
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
  play: async ({ canvasElement }) => {
    const label = "Prompt Studio research and documentation for the desktop release";
    const tab = within(canvasElement).getByRole("tab", { name: label });
    const text = tab.querySelector("span")!;
    await expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
    await expect(text).toHaveStyle({ textOverflow: "ellipsis", whiteSpace: "nowrap" });
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.hover(tab);
    await expect(await page.findByRole("tooltip")).toHaveTextContent(label);
    await userEvent.keyboard("{Escape}");
    await userEvent.unhover(tab);
    tab.focus();
    await expect(await page.findByRole("tooltip")).toHaveTextContent(label);
  },
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

export const Crowded: Story = {
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
  play: async ({ canvasElement }) => expectOpenProjectAfterTabs(canvasElement),
};
