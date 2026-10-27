import { Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
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
  workbench.pageLocations.setProject("storybook-notes");
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
  parameters: { layout: "fullscreen" },
  tags: ["new-resource-cards"],
} satisfies Meta<typeof NotesCards>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CreateFromCardAndMenu: Story = {
  render: () => <NotesCards />,
  play: async ({ canvasElement }) => {
    const main = within(canvasElement.querySelector('[data-workbench-panel="main"]') as HTMLElement);
    const cards = within(await main.findByRole("group", { name: "Available tabs" }));
    await userEvent.click(cards.getByRole("button", { name: "New note" }));
    await expect(await main.findByRole("tab", { name: "Note 1" })).toBeVisible();
    await userEvent.click(main.getByRole("button", { name: "Add panel" }));
    const body = within(document.body);
    await userEvent.click(await body.findByRole("menuitem", { name: "New note" }));
    await expect(await main.findByRole("tab", { name: "Note 2" })).toHaveAttribute("aria-selected", "true");
    await expect(main.getByRole("tab", { name: "Note 1" })).toBeVisible();
  },
};

export const CreateFromNumber: Story = {
  render: () => <NotesCards />,
  play: async ({ canvasElement }) => {
    const main = within(canvasElement.querySelector('[data-workbench-panel="main"]') as HTMLElement);
    const cards = within(await main.findByRole("group", { name: "Available tabs" }));
    await userEvent.keyboard("{Alt>}{Shift>}[Space]{/Shift}{/Alt}");
    await expect(within(cards.getByRole("button", { name: "New note" })).getByLabelText("1")).toBeVisible();
    await userEvent.keyboard("1");
    await expect(await main.findByRole("tab", { name: "Note 1" })).toBeVisible();
  },
};
