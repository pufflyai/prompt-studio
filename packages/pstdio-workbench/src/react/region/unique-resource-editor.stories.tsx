import { Button, Input, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const home = { kind: "page", extensionId: "storybook", id: "home" } as const;
const editor = { kind: "page", extensionId: "storybook", id: "editor" } as const;
const resource = { type: "note", id: "first", extensionId: "storybook", projectId: "project", label: "Working note" };
const createEditorWorkbench = () => {
  const w = createWorkbench({ startPage: home, initialSidePanelMode: "closed" });
  for (const id of ["project", "review"])
    w.modes.registerMode({ id, basePage: home, panels: ["main", "side", "secondary"], activate() {} });
  w.views.registerView({
    id: "home",
    title: "Notes",
    body: {
      kind: "react",
      render: () => (
        <Stack p="md" gap="sm">
          <Text>Notes</Text>
          <Button onClick={() => w.pageLocations.navigate({ kind: "page", page: editor, resource, open: "pin" })}>
            Open note
          </Button>
          <Button
            onClick={() =>
              w.navigation.openTarget({
                kind: "panel",
                panel: { kind: "shell-placement", id: "note" },
                resource,
                open: "pin",
              })
            }
          >
            Open through another tool
          </Button>
          <Button onClick={() => w.modes.setActiveMode("review")}>Review mode</Button>
          <Button onClick={() => w.modes.setActiveMode("project")}>Project mode</Button>
        </Stack>
      ),
    },
  });
  w.views.registerView({
    id: "note",
    title: "Note",
    instancePolicy: "per-resource",
    body: {
      kind: "react",
      render: ({ instance }) => (
        <Stack p="md" gap="sm">
          <Input aria-label="Unsaved note" defaultValue="Draft" />
          <Button onClick={() => w.movePanel(instance.instanceId, "side")}>Move to Side</Button>
          <Button onClick={() => w.pageLocations.navigate({ kind: "page", page: home })}>Back to notes</Button>
        </Stack>
      ),
    },
  });
  w.pages.registerPage({
    id: "home",
    ref: home,
    path: "home",
    modeId: "project",
    modeIds: ["project", "review"],
    main: { kind: "view", view: { kind: "view", id: "home" }, cardinality: "one" },
    slots: [],
  });
  w.pages.registerPage({
    id: "editor",
    ref: editor,
    parentId: "home",
    path: "note",
    modeId: "project",
    modeIds: ["project"],
    resource: { kinds: [{ kind: "resource-kind", id: "note" }] },
    main: { kind: "view", view: { kind: "view", id: "note" }, cardinality: "many" },
    slots: [],
  });
  w.shellPlacements.registerPlacement({
    id: "note",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "note" }],
        view: { kind: "view", id: "note" },
        cardinality: "many",
      },
    },
  });
  w.pageLocations.boot("project");
  return w;
};
const workbench = createEditorWorkbench();
const meta = {
  title: "pstdio-workbench/Reference/Core API/Unique resource editor",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
  args: { workbench },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RetainedDraft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Open note" }));
    const draft = await canvas.findByRole("textbox", { name: "Unsaved note" });
    await userEvent.clear(draft);
    await userEvent.type(draft, "Keep this unsaved draft");
    await userEvent.click(canvas.getByRole("button", { name: "Back to notes" }));
    await userEvent.click(canvas.getByRole("button", { name: "Open through another tool" }));
    await expect(canvas.getByRole("textbox", { name: "Unsaved note" })).toBe(draft);
    await userEvent.click(canvas.getByRole("button", { name: "Move to Side" }));
    await expect(draft).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Open through another tool" }));
    await expect(canvas.getByRole("textbox", { name: "Unsaved note" })).toBe(draft);
    await userEvent.click(canvas.getByRole("button", { name: "Review mode" }));
    await expect(draft).not.toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Project mode" }));
    await expect(canvas.getByRole("textbox", { name: "Unsaved note" })).toBe(draft);
    await expect(draft).toHaveValue("Keep this unsaved draft");
  },
};
