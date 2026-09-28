import type { Meta, StoryObj } from "@storybook/react";
import { ExtensionFolderDropZone } from "./extension-folder-drop-zone";

const meta: Meta<typeof ExtensionFolderDropZone> = {
  title: "ProjectSettings/ExtensionFolderDropZone",
  component: ExtensionFolderDropZone,
  args: { onDropFolder: () => {} },
};

export default meta;

type Story = StoryObj<typeof ExtensionFolderDropZone>;

export const Idle: Story = {};

// Files dragged over the zone highlight it until they are dropped or leave.
export const DragOver: Story = {
  play: async ({ canvasElement }) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(["{}"], "package.json"));
    canvasElement
      .querySelector('[data-testid="extension-folder-drop-zone"]')
      ?.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer }));
  },
};

export const Uploading: Story = {
  args: { addingName: "my-extension" },
};
