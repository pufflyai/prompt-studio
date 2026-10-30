import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { type ComponentProps, useLayoutEffect, useState } from "react";
import { FolderPickerDialog } from "./folder-picker-dialog";

const meta = {
  title: "Overlays/FolderPickerDialog",
  component: FolderPickerDialog,
  description:
    "Open a project in an existing folder or create a folder first. The host owns navigation and creation. Hidden folders start hidden; press Cmd/Ctrl+Shift+. to toggle them. Matches the folder picker states in Pencil node LmcML.",
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
} satisfies CanvasMeta<typeof FolderPickerDialog>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Folders: Story = {
  id: "overlays-folderpickerdialog--folders",
};
export const Empty: Story = {
  id: "overlays-folderpickerdialog--empty",
  args: { entries: [] },
};
export const Loading: Story = {
  id: "overlays-folderpickerdialog--loading",
  args: { isLoading: true },
};
const DelayedDirectoryList = (props: ComponentProps<typeof FolderPickerDialog>) => {
  const [listing, setListing] = useState({ currentPath: "", isLoading: true });
  useLayoutEffect(() => {
    const completeListing = () => setListing({ currentPath: "/Users/alex/Documents", isLoading: false });
    document.addEventListener("folder-picker-list-loaded", completeListing, { once: true });
    return () => document.removeEventListener("folder-picker-list-loaded", completeListing);
  }, []);
  return <FolderPickerDialog {...props} {...listing} />;
};
export const TypedPathAfterLoading: Story = {
  id: "overlays-folderpickerdialog--typed-path-after-loading",
  render: (args) => <DelayedDirectoryList {...args} />,
};
export const Opening: Story = {
  id: "overlays-folderpickerdialog--opening",
  args: { isOpening: true },
};
export const CreationCollision: Story = {
  id: "overlays-folderpickerdialog--creation-collision",
  args: { error: "A folder with that name already exists." },
};
export const PermissionError: Story = {
  id: "overlays-folderpickerdialog--permission-error",
  args: { error: "Permission denied while opening this folder." },
};
export const WindowsDriveRoot: Story = {
  id: "overlays-folderpickerdialog--windows-drive-root",
  args: { currentPath: "C:\\", entries: [] },
};
export const NetworkShareRoot: Story = {
  id: "overlays-folderpickerdialog--network-share-root",
  args: { currentPath: "\\\\server\\share", entries: [] },
};
export const CreateFolderEmpty: Story = {
  id: "overlays-folderpickerdialog--create-folder-empty",
};
export const CreateFolderNamed: Story = {
  id: "overlays-folderpickerdialog--create-folder-named",
};
export const HiddenFolders: Story = {
  id: "overlays-folderpickerdialog--hidden-folders",
};
