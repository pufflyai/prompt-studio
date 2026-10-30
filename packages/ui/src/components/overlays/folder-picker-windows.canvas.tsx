import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { type ComponentProps, useState } from "react";
import { FolderPickerDialog } from "./folder-picker-dialog";

const drives = ["C", "D", "E"].map((letter) => ({ name: `${letter}:`, path: `${letter}:\\` }));
const paths: Record<string, string[]> = {
  "C:\\Users\\Alex": ["Documents", "Downloads"],
  "C:\\": ["Users", "Windows"],
  "D:\\": ["Projects", "Shared"],
  "D:\\Projects": ["My tools", "Notes", "Prototypes"],
  "D:\\Projects\\My tools": [],
  "\\\\server\\share": ["Team"],
};
const entries = (path: string) =>
  (paths[path] ?? []).map((name) => ({
    name,
    path: `${path.replace(/\\$/, "")}\\${name}`,
    isDirectory: true,
  }));
const WindowsPicker = (props: ComponentProps<typeof FolderPickerDialog>) => {
  const [path, setPath] = useState(props.currentPath);
  const unavailable = !Object.hasOwn(paths, path);
  return (
    <FolderPickerDialog
      {...props}
      currentPath={path}
      entries={entries(path)}
      isUnavailable={unavailable}
      error={unavailable ? "This drive is unavailable." : undefined}
      onNavigate={(next) => setPath(next === "~" ? "C:\\Users\\Alex" : next.replaceAll("/", "\\"))}
    />
  );
};
const meta = {
  title: "Overlays/FolderPickerDialog/Windows",
  component: FolderPickerDialog,
  tags: ["folder-picker"],
  parameters: {
    docs: {
      description: {
        component:
          "Windows drives come from the runtime host. Selection only navigates; Open folder confirms. Matches Pencil frame XuQrP. Unix runtimes supply no drives. UNC paths leave the drive unselected.",
      },
    },
  },
  args: {
    open: true,
    currentPath: "D:\\Projects",
    entries: entries("D:\\Projects"),
    drives,
    onClose: () => {},
    onSelect: () => {},
    onNavigate: () => {},
    onCreateFolder: async () => {},
  },
  render: (args) => <WindowsPicker {...args} />,
} satisfies CanvasMeta<typeof FolderPickerDialog>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Browse: Story = {
  id: "overlays-folderpickerdialog-windows--browse",
};
export const DriveMenu: Story = {
  id: "overlays-folderpickerdialog-windows--drive-menu",
};
export const UnavailableDrive: Story = {
  id: "overlays-folderpickerdialog-windows--unavailable-drive",
  args: { currentPath: "E:\\" },
};
export const KeyboardNavigation: Story = {
  id: "overlays-folderpickerdialog-windows--keyboard-navigation",
};
export const TypedPath: Story = {
  id: "overlays-folderpickerdialog-windows--typed-path",
};
export const SingleDrive: Story = {
  id: "overlays-folderpickerdialog-windows--single-drive",
  args: { currentPath: "C:\\", drives: drives.slice(0, 1) },
};
export const Loading: Story = {
  id: "overlays-folderpickerdialog-windows--loading",
  args: { isLoading: true },
};
