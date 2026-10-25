import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useLayoutEffect, useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { FolderPickerDialog } from "./folder-picker-dialog";

const meta = {
  title: "Overlays/FolderPickerDialog",
  component: FolderPickerDialog,
  tags: ["folder-picker"],
  parameters: {
    docs: {
      description: {
        component:
          "Open a project in an existing folder or create a folder first. The host owns navigation and creation. Hidden folders start hidden; press Cmd/Ctrl+Shift+. to toggle them. Matches the folder picker states in Pencil node LmcML.",
      },
    },
  },
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
export const Folders: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    const home = canvas.getByRole("button", { name: "Go to home directory" }).getBoundingClientRect();
    const path = canvas.getByRole("textbox", { name: "Folder path" }).getBoundingClientRect();
    const create = canvas.getByRole("button", { name: "New folder", exact: true }).getBoundingClientRect();
    const filter = canvas.getByRole("textbox", { name: "Filter folders" });
    const filterBounds = filter.getBoundingClientRect();
    await expect(home.width).toBeCloseTo(home.height, 0);
    await expect(path.y).toBeCloseTo(home.y, 0);
    await expect(create.y).toBeCloseTo(home.y, 0);
    await expect(filterBounds.width).toBeCloseTo(create.right - home.x, 0);
    await userEvent.type(filter, "Draft");
    await expect(within(canvas.getByLabelText("Folders")).getAllByRole("option")).toHaveLength(1);
    await userEvent.clear(filter);
  },
};
export const Empty: Story = { args: { entries: [] } };
export const Loading: Story = { args: { isLoading: true } };

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
  tags: ["!manifest", "folder-path-regression"],
  render: (args) => <DelayedDirectoryList {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    const input = canvas.getByRole("textbox", { name: "Folder path" }) as HTMLInputElement;
    await expect(input).toBeDisabled();
    const enabled = Promise.withResolvers<string>();
    const observer = new MutationObserver(() => {
      if (input.disabled) return;
      observer.disconnect();
      enabled.resolve(input.value);
    });
    observer.observe(input, { attributes: true, attributeFilter: ["disabled"] });
    try {
      canvasElement.ownerDocument.dispatchEvent(new Event("folder-picker-list-loaded"));
      const pathAtEnable = await enabled.promise;
      const typedPath = "/Users/alex/研究/new tool";
      await userEvent.clear(input);
      await userEvent.type(input, typedPath, { delay: null });
      await expect(input).toHaveValue(typedPath);
      await expect(pathAtEnable).toBe("/Users/alex/Documents");
    } finally {
      observer.disconnect();
    }
  },
};
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
    await expect(canvas.getAllByRole("button", { name: "Cancel", exact: true })).toHaveLength(1);
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

export const HiddenFolders: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    const folders = within(canvas.getByLabelText("Folders"));
    const filter = canvas.getByRole("textbox", { name: "Filter folders" });
    await expect(folders.queryByRole("option", { name: ".research" })).not.toBeInTheDocument();
    await userEvent.click(filter);
    await userEvent.keyboard("{Control>}{Shift>}[Period]{/Shift}{/Control}");
    await expect(folders.getByRole("option", { name: ".research" })).toBeVisible();
    await expect(filter).toHaveValue("");
    await userEvent.type(filter, "research");
    await expect(folders.getAllByRole("option")).toHaveLength(1);
    await userEvent.keyboard("{Meta>}{Shift>}[Period]{/Shift}{/Meta}");
    await expect(folders.queryByRole("option", { name: ".research" })).not.toBeInTheDocument();
    await userEvent.clear(filter);
    await expect(folders.getAllByRole("option")).toHaveLength(3);
  },
};
