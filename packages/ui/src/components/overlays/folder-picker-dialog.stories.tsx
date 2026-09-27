import type { Meta, StoryObj } from "@storybook/react";
import { FolderPickerDialog } from "./folder-picker-dialog";

const meta = {
  title: "Overlays/FolderPickerDialog",
  component: FolderPickerDialog,
  args: {
    open: true,
    currentPath: "/Users/alex/Documents",
    entries: [".research", "1234", "Drafts", "研究"].map((name) => ({
      name,
      path: `/Users/alex/Documents/${name}`,
      isDirectory: true,
    })),
    onClose: () => {},
    onSelect: () => {},
    onNavigate: () => {},
    onCreateFolder: async () => {},
  },
} satisfies Meta<typeof FolderPickerDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Folders: Story = {};
export const Empty: Story = { args: { entries: [] } };
export const Loading: Story = { args: { isLoading: true } };
export const Opening: Story = { args: { isOpening: true } };
export const CreationCollision: Story = { args: { error: "A folder with that name already exists." } };
export const PermissionError: Story = { args: { error: "Permission denied while opening this folder." } };

export const WindowsDriveRoot: Story = { args: { currentPath: "C:\\", entries: [] } };
export const NetworkShareRoot: Story = { args: { currentPath: "\\\\server\\share", entries: [] } };
