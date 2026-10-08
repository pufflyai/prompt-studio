import { Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { PaletteParamsDialog } from "../command-palette/palette-params-dialog";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { RegionTabMenu } from "./region-tab-menu";

const NoteTabActions = () => {
  const [result, setResult] = useState("No action run");
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
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
    return instance;
  });
  return (
    <Stack>
      <Button
        onClick={(event) => {
          setAnchor(event.currentTarget.getBoundingClientRect().toJSON());
          setOpen(true);
        }}
      >
        Note actions
      </Button>
      <Text>{result}</Text>
      <RegionTabMenu
        anchor={anchor}
        label="Note"
        open={open}
        setOpen={setOpen}
        workbench={workbench}
        placement={{ widgetId: "note-1", contributionId: "note-slot" }}
        groups={[
          {
            id: "note",
            rows: [
              {
                id: "rename",
                label: "Rename note",
                action: {
                  kind: "navigation",
                  target: {
                    kind: "command",
                    commandId: "rename",
                    args: { noteId: "note-1", title: "Existing title" },
                  },
                },
              },
              {
                id: "delete",
                label: "Delete",
                action: {
                  kind: "navigation",
                  target: {
                    kind: "command",
                    commandId: "delete",
                    args: { noteId: "note-1" },
                  },
                },
              },
            ],
          },
        ]}
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
    await userEvent.click(await body.findByRole("menuitem", { name: "Rename note" }));
    const dialog = await body.findByRole("dialog", { name: "Rename note" });
    const title = within(dialog).getByRole("textbox", { name: "Title" });
    await expect(title).toHaveValue("Existing title");
    await userEvent.clear(title);
    await userEvent.type(title, "New title");
    await userEvent.click(within(dialog).getByRole("button", { name: "Run" }));
    await waitFor(() => expect(canvas.getByText("Renamed note-1 to New title")).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Note actions" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Delete" }));
    await waitFor(() => expect(canvas.getByText("Deleted note-1")).toBeVisible());
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
  },
};
