import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
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

export const CreateFolderEmpty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "New folder", exact: true }));
    await expect(canvas.getByRole("button", { name: "Create folder", exact: true })).toBeDisabled();
    await expect(canvas.queryByRole("button", { name: "Open folder", exact: true })).not.toBeInTheDocument();
  },
};

export const CreateFolderNamed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "New folder", exact: true }));
    await userEvent.type(canvas.getByRole("textbox", { name: "New folder name" }), "assets");
    await expect(canvas.getByRole("button", { name: "Create folder", exact: true })).toBeEnabled();
    await expect(canvas.queryByRole("textbox", { name: "Filter folders" })).not.toBeInTheDocument();
  },
};
