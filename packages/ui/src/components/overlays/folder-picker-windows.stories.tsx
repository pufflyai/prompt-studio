import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
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
    onClose: fn(),
    onSelect: fn(),
    onNavigate: fn(),
    onCreateFolder: async () => {},
  },
  render: (args) => <WindowsPicker {...args} />,
} satisfies Meta<typeof FolderPickerDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Browse: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Drive", exact: true }));
    await userEvent.click(canvas.getByRole("menuitem", { name: "C:", exact: true }));
    await expect(canvas.getByRole("textbox", { name: "Folder path" })).toHaveValue("C:\\");
    await expect(canvas.getByRole("button", { name: "Go to parent directory" })).toBeDisabled();
    await expect(args.onSelect).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Go to home directory" }));
    await expect(canvas.getByRole("textbox", { name: "Folder path" })).toHaveValue("C:\\Users\\Alex");
  },
};
export const DriveMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Drive", exact: true }));
    await expect(canvas.getAllByRole("menuitem")).toHaveLength(3);
  },
};
export const UnavailableDrive: Story = {
  args: { currentPath: "E:\\" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(canvas.getByRole("alert")).toBeVisible());
    await expect(canvas.getByRole("button", { name: "Open folder", exact: true })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "New folder", exact: true })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Drive", exact: true }));
    await userEvent.click(canvas.getByRole("menuitem", { name: "D:", exact: true }));
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Open folder", exact: true })).toBeEnabled();
  },
};
export const KeyboardNavigation: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    const drive = canvas.getByRole("button", { name: "Drive", exact: true });
    await waitFor(() => expect(drive).toBeVisible());
    drive.focus();
    await userEvent.keyboard("{ArrowDown}{Escape}");
    await expect(drive).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{Home}{ArrowDown}{Enter}");
    await expect(canvas.getByRole("textbox", { name: "Folder path" })).toHaveValue("D:\\");
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};
export const TypedPath: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    const path = canvas.getByRole("textbox", { name: "Folder path" });
    await userEvent.clear(path);
    await userEvent.type(path, "C:\\Users\\Alex{Enter}");
    await expect(canvas.getByRole("button", { name: "Drive", exact: true })).toHaveTextContent("C:");
    await userEvent.clear(path);
    await userEvent.type(path, "\\\\server\\share{Enter}");
    await expect(canvas.getByRole("button", { name: "Drive", exact: true })).toHaveTextContent("Drive");
    await expect(canvas.getByRole("button", { name: "Go to parent directory" })).toBeDisabled();
  },
};
export const SingleDrive: Story = { args: { currentPath: "C:\\", drives: drives.slice(0, 1) } };
export const Loading: Story = { args: { isLoading: true } };
