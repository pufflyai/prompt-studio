import type { CanvasMeta } from "@pstdio/canvas";
import { WorkbenchThemeProvider } from "../../react/theme/workbench-theme-provider";
import { SeparateWindows, TabMenu } from "./separate-windows-previews";

const meta = {
  title: "Proposals/PS-1128 Separate windows",
  description:
    "Move any page or panel tab into its own window. Each window is a full workbench for the same project. Closing a window returns its tabs to the main window.",
  decorators: [
    (Frame) => (
      <WorkbenchThemeProvider>
        <Frame />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies CanvasMeta;
export default meta;

export const TwoWindows = {
  name: "Two windows",
  fullscreen: true,
  description:
    "Right-click a tab and choose Move to new window. Window 2 opens with the tab in its Main area. Move it back from its tab menu, or close Window 2 to return every tab to its panel in the main window. This prototype opens at most one extra window; production allows several, as in the Tab menu frame.",
  render: () => <SeparateWindows />,
};

export const WindowTabMenu = {
  name: "Tab menu",
  description:
    "The tab menu with a Window group above the tab actions. Choose how many other windows are open: Move to new window is always there, and each open window adds a Move to <window> row.",
  render: (args: { tab: "main" | "side"; otherWindows: number }) => (
    <TabMenu tab={args.tab} otherWindows={args.otherWindows} />
  ),
  args: { tab: "main", otherWindows: 0 },
  controls: {
    tab: {
      type: "select" as const,
      label: "Tab",
      options: [
        { value: "main", label: "Main page tab" },
        { value: "side", label: "Side panel tab" },
      ],
    },
    otherWindows: { type: "number" as const, label: "Other open windows", min: 0, max: 3, step: 1 },
  },
};
