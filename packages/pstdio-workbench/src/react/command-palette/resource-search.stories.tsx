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
