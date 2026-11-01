import { Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createNotesWorkbench = () => {
  const workbench = createWorkbench();
  const page = { kind: "page", extensionId: "example", id: "notes" } as const;
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.views.registerView({
    id: "note",
    title: "Note",
    icon: "FileText",
    body: { kind: "react", render: () => <Text p="md">Note content</Text> },
  });
  workbench.views.registerView({ id: "terminal", title: "Terminal", body: { kind: "react", render: () => null } });
  workbench.shellPlacements.registerPlacement({
    id: "terminal",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "terminal" }, presence: "closed" },
  });
  let nextNote = 0;
  workbench.commands.registerCommand(
    { id: "create-note", label: "New note", icon: "FilePlus" },
    {
      execute: () => {
        nextNote += 1;
        workbench.pages.openSlot({
          pageId: "notes",
          slotId: "note",
          resource: { type: "note", id: String(nextNote), label: `Note ${nextNote}` },
          open: "pin",
        });
      },
    },
  );
  workbench.pages.registerPage({
    id: "notes",
    ref: page,
    path: "notes",
    modeId: "project",
    main: { kind: "panels" },
    slots: [
      {
        id: "note",
        region: "main",
        addableIn: ["main"],
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "note" }],
            view: { kind: "view", id: "note" },
            cardinality: "many",
            add: { kind: "command", target: { command: { kind: "command", id: "create-note" } } },
          },
        },
      },
    ],
  });
  workbench.pageLocations.setProject("preview-notes");
  workbench.pageLocations.navigate({ kind: "page", page });
  return workbench;
};
const NotesCards = () => {
  const [workbench] = useState(createNotesWorkbench);
  return <WorkbenchStory workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/New resource cards",
  component: NotesCards,
  fullscreen: true,
} satisfies CanvasMeta<typeof NotesCards>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const CreateFromCardAndMenu: Story = {
  id: "pstdio-workbench-reference-core-api-new-resource-cards--create-from-card-and-menu",
  render: () => <NotesCards />,
};
export const CreateFromNumber: Story = {
  id: "pstdio-workbench-reference-core-api-new-resource-cards--create-from-number",
  render: () => <NotesCards />,
};
