import type { Meta, StoryObj } from "@storybook/react";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { FileRendererPathHeader } from "./file-renderer-path-header";

const meta = {
  title: "pstdio-workbench/File editor/Save status",
  component: FileRendererPathHeader,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
  args: { fileName: "notes.ts", filePath: "src/notes.ts" },
} satisfies Meta<typeof FileRendererPathHeader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Saved: Story = {};
export const Unsaved: Story = { args: { dirty: true } };
export const Saving: Story = { args: { dirty: true, saving: true } };
