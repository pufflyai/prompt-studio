import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
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
} satisfies CanvasMeta<typeof FileRendererPathHeader>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Saved: Story = {
  id: "pstdio-workbench-file-editor-save-status--saved",
};
export const Unsaved: Story = {
  id: "pstdio-workbench-file-editor-save-status--unsaved",
  args: { dirty: true },
};
export const Saving: Story = {
  id: "pstdio-workbench-file-editor-save-status--saving",
  args: { dirty: true, saving: true },
};
