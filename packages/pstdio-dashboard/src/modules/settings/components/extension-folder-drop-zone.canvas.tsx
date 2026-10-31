import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ExtensionFolderDropZone } from "./extension-folder-drop-zone";

const meta: CanvasMeta<typeof ExtensionFolderDropZone> = {
  title: "ProjectSettings/ExtensionFolderDropZone",
  component: ExtensionFolderDropZone,
  args: { onDropFolder: () => {} },
};
export default meta;
type Story = CanvasFrame<typeof ExtensionFolderDropZone>;
export const Idle: Story = {
  id: "projectsettings-extensionfolderdropzone--idle",
};
// Files dragged over the zone highlight it until they are dropped or leave.
export const DragOver: Story = {
  id: "projectsettings-extensionfolderdropzone--drag-over",
};
export const Uploading: Story = {
  id: "projectsettings-extensionfolderdropzone--uploading",
  args: { addingName: "my-extension" },
};
