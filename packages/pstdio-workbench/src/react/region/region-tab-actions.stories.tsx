import { Button, Input, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useId, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench, resourceContextMenuPath } from "../../core";
import { PaletteParamsDialog } from "../command-palette/palette-params-dialog";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { RegionTabMenu } from "./region-tab-menu";
import { useTabContextMenu } from "./use-tab-context-menu";

const NoteTabActions = () => {
  const [result, setResult] = useState("No action run");
  const triggerId = useId();
  const { menu, show, onContextMenu } = useTabContextMenu(triggerId);
  const [workbench] = useState(() => {
    const instance = createWorkbench();
    const noteId = { type: "text" as const, label: "Note", required: true, resolvedFrom: "resource" as const };
    instance.commands.registerCommand(
      {
        id: "rename",
        label: "Rename note",
        params: { noteId, title: { type: "text", label: "Title", required: true } },
      },
      {
        execute: (args) => {
          const { noteId, title } = args as { noteId: string; title: string };
          setResult(`Renamed ${noteId} to ${title}`);
        },
      },
    );
    instance.commands.registerCommand(
      { id: "delete", label: "Delete", params: { noteId } },
      { execute: (args) => setResult(`Deleted ${(args as { noteId: string }).noteId}`) },
    );
    instance.resources.registerKind({ kind: "note", label: "Note" });
    instance.layout.registerMenuItem(resourceContextMenuPath("note"), {
      commandId: "rename",
      args: { title: "Existing title" },
    });
    instance.layout.registerMenuItem(resourceContextMenuPath("note"), { commandId: "delete" });
    return instance;
  });
  return (
    <Stack>
      <Button id={triggerId} onClick={(event) => show(event.currentTarget)} onContextMenu={onContextMenu}>
        Note actions
      </Button>
      <Text>{result}</Text>
      <Input aria-label="Draft outside the menu" placeholder="Keep focus here when dismissing the menu" />
      <RegionTabMenu
        menu={menu}
        label="Note"
        workbench={workbench}
        placement={{
          widgetId: "note-1",
          contributionId: "note-slot",
          resource: { type: "note", id: "note-1", label: "Existing title" },
        }}
        groups={[]}
      />
      <PaletteParamsDialog workbench={workbench} />
    </Stack>
  );
};

const meta = {
  title: "pstdio-workbench/Guides/Tab actions",
  component: NoteTabActions,
  tags: ["!manifest"],
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies Meta<typeof NoteTabActions>;
export default meta;
export const EditableTitleAndBoundResource: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await userEvent.click(canvas.getByRole("button", { name: "Note actions" }));
    await body.findByRole("menuitem", { name: "Rename note" });
    await userEvent.keyboard("{Home}{Enter}");
    const dialog = await body.findByRole("dialog", { name: "Rename note" });
    const title = within(dialog).getByRole("textbox", { name: "Title" });
    await expect(title).toHaveValue("Existing title");
    await userEvent.clear(title);
    await userEvent.type(title, "New title");
    await userEvent.click(within(dialog).getByRole("button", { name: "Run" }));
    await waitFor(() => expect(canvas.getByText("Renamed note-1 to New title")).toBeVisible());
    await waitFor(() => expect(body.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "Note actions" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Delete" }));
    await waitFor(() => expect(canvas.getByText("Deleted note-1")).toBeVisible());
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Note actions" }));
    await body.findByRole("menuitem", { name: "Delete" });
    const draft = canvas.getByRole("textbox", { name: "Draft outside the menu" });
    await userEvent.click(draft);
    await waitFor(() => expect(body.queryByRole("menu")).not.toBeInTheDocument());
    await expect(draft).toHaveFocus();
  },
};
