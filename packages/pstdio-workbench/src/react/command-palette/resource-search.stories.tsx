import type { Meta, StoryObj } from "@storybook/react";
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
    onClose() {},
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
export const FullHistory: StoryObj<typeof meta> = {};
export const Empty: StoryObj<typeof meta> = {
  args: { request: { label: "Switch session", placeholder: "Search sessions", list: () => [] } },
};
