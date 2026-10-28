import type { Meta, StoryObj } from "@storybook/react";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { FileRendererErrorNotice } from "./file-renderer-error-notice";

const meta = {
  title: "pstdio-workbench/File editor/Resource removed",
  component: FileRendererErrorNotice,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies Meta<typeof FileRendererErrorNotice>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RetainedDraft: Story = {
  args: {
    message: "This resource was removed. Your draft is kept here. Copy it before closing this tab.",
  },
};
