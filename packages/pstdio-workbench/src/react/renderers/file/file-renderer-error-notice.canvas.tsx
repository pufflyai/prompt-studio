import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
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
} satisfies CanvasMeta<typeof FileRendererErrorNotice>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const RetainedDraft: Story = {
  id: "pstdio-workbench-file-editor-resource-removed--retained-draft",
  args: {
    message: "This resource was removed. Your draft is kept here. Copy it before closing this tab.",
  },
};
