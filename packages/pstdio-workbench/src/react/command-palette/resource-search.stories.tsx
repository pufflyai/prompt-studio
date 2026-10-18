import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchResourceSearch } from "./resource-search";

const workbench = createWorkbench();
const meta = {
  title: "pstdio-workbench/Components/Resource search",
  component: WorkbenchResourceSearch,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
  args: {
    workbench,
    onClose: fn(),
    request: {
      label: "Switch session",
      placeholder: "Search sessions",
      list: () =>
        Array.from({ length: 200 }, (_, index) => ({
          resource: {
            type: "session",
            id: String(index),
            label: `Session ${String(index).padStart(3, "0")}`,
            icon: "MessageCircle",
          },
          activate() {},
        })),
    },
  },
} satisfies Meta<typeof WorkbenchResourceSearch>;
export default meta;
export const FullHistory: StoryObj<typeof meta> = {
  play: async ({ canvasElement, args }) => {
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog", { name: "Switch session" });
    const search = within(dialog).getByPlaceholderText("Search sessions");
    await userEvent.type(search, "Session 199");
    await expect(within(dialog).getByRole("option", { name: "Session 199" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(search).toHaveValue("");
    await expect(args.onClose).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};
export const Empty: StoryObj<typeof meta> = {
  args: { request: { label: "Switch session", placeholder: "Search sessions", list: () => [] } },
};

export const StatusIndicators: StoryObj<typeof meta> = {
  args: {
    request: {
      label: "Switch session",
      placeholder: "Search sessions",
      list: () =>
        [
          { label: "Running", icon: "LoaderCircle", color: "fg.info" },
          { label: "Waiting for input", icon: "CircleDot", color: "fg.warning" },
          { label: "Queued", icon: "ClockAlert", color: "fg.info" },
          { label: "Completed", icon: "CircleCheck", color: "fg.success" },
          { label: "Failed", icon: "CircleAlert", color: "fg.error" },
          { label: "Cancelled", icon: "CircleStop", color: "fg.warning" },
          { label: "Disconnected", icon: "CirclePause", color: "fg.warning" },
          { label: "Unknown", icon: "CircleDashed", color: "fg.muted" },
        ].map(({ label, icon, color }) => ({
          resource: { type: "session", id: label, label: `${label} session`, icon: "MessageCircle" },
          indicator: { icon, color, label: `Session status: ${label}` },
          activate() {},
        })),
    },
  },
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog", { name: "Switch session" });
    await expect(within(dialog).getByRole("img", { name: "Session status: Completed" })).toBeVisible();
    await expect(within(dialog).getByRole("img", { name: "Session status: Failed" })).toBeVisible();
  },
};

const ownedWorkbench = createWorkbench();
ownedWorkbench.resources.registerKind({ kind: "drawing", extensionId: "first", label: "First", icon: "File" });
ownedWorkbench.resources.registerKind({ kind: "drawing", extensionId: "second", label: "Second", icon: "Folder" });
export const OwnerIcons: StoryObj<typeof meta> = {
  args: {
    workbench: ownedWorkbench,
    request: {
      label: "Owner icons",
      placeholder: "Search drawings",
      list: () => [
        { resource: { type: "drawing", id: "one", extensionId: "first", label: "First drawing" }, activate() {} },
        { resource: { type: "drawing", id: "one", extensionId: "second", label: "Second drawing" }, activate() {} },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog", { name: "Owner icons" });
    const first = within(dialog).getByRole("option", { name: "First drawing" });
    const second = within(dialog).getByRole("option", { name: "Second drawing" });
    await expect(first.querySelector("svg.lucide-file")).toBeInTheDocument();
    await expect(second.querySelector("svg.lucide-folder")).toBeInTheDocument();
  },
};
