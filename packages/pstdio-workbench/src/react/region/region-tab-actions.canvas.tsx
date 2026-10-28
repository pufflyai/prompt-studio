import { Button, Input, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useId, useState } from "react";
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
          const { noteId, title } = args as {
            noteId: string;
            title: string;
          };
          setResult(`Renamed ${noteId} to ${title}`);
        },
      },
    );
    instance.commands.registerCommand(
      { id: "delete", label: "Delete", params: { noteId } },
      {
        execute: (args) =>
          setResult(
            `Deleted ${
              (
                args as {
                  noteId: string;
                }
              ).noteId
            }`,
          ),
      },
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
} satisfies CanvasMeta<typeof NoteTabActions>;
export default meta;
export const EditableTitleAndBoundResource: CanvasVariant<typeof meta> = {
  id: "pstdio-workbench-guides-tab-actions--editable-title-and-bound-resource",
};
