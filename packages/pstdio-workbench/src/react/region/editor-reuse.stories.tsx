import { Button, Input, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";

const page = (id: string) => ({ kind: "page" as const, extensionId: "notes", id });
const resource = { type: "note", id: "one", label: "Working note" };
const createExample = () => {
  const w = createWorkbench({ startPage: page("home"), initialSidePanelMode: "attached" });
  w.modes.registerMode({ id: "project", activate() {} });
  w.views.registerView({
    id: "editor",
    title: "Editor",
    body: {
      kind: "react",
      render: () => (
        <Stack p="md">
          <Text>Working note</Text>
          <Input aria-label="Unsaved draft" defaultValue="Draft" />
        </Stack>
      ),
    },
  });
  w.views.registerView({
    id: "collection",
    title: "Notes",
    body: { kind: "react", render: () => <Text p="md">Notes collection</Text> },
  });
  w.pages.registerPage({
    id: "home",
    ref: page("home"),
    title: "Notes",
    path: "home",
    modeId: "project",
    main: { kind: "panels", empty: { kind: "view", id: "collection" } },
    slots: [],
  });
  for (const id of ["note", "another-tool"])
    w.pages.registerPage({
      id,
      ref: page(id),
      title: "Working note",
      path: id,
      modeId: "project",
      parentId: "home",
      resource: { kinds: [{ kind: "resource-kind", id: "note" }] },
      main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
      slots: [],
    });
  w.modePlacements.registerPlacement({
    id: "editor",
    ref: { kind: "placement", extensionId: "tools", id: "editor" },
    modeId: "project",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "note" }],
        view: { kind: "view", id: "editor" },
        cardinality: "many",
      },
    },
  });
  w.pageLocations.boot("example");
  return w;
};
const Journey = () => {
  const [w] = useState(createExample);
  const move = (region: "main" | "side" | "secondary") => {
    const editor = Object.values(w.layout.getLayout().regions)
      .flatMap((r) => r.widgets)
      .find((p) => p.viewId === "editor")!;
    w.movePanel(editor.widgetId, region);
    if (region !== "main") void w.navigation.openTarget({ kind: "page", page: page("home") });
  };
  return (
    <Stack h="100dvh" gap="0">
      <Stack direction="row" p="sm">
        <Button
          size="sm"
          onClick={() => void w.navigation.openTarget({ kind: "page", page: page("note"), resource, open: "pin" })}
        >
          Open note
        </Button>
        <Button size="sm" onClick={() => move("main")}>
          Move to Main
        </Button>
        <Button size="sm" onClick={() => move("side")}>
          Move to Side
        </Button>
        <Button size="sm" onClick={() => move("secondary")}>
          Move to Bottom
        </Button>
        <Button
          size="sm"
          onClick={() => void w.navigation.openTarget({ kind: "page", page: page("another-tool"), resource })}
        >
          Open through another tool
        </Button>
        <Button
          size="sm"
          onClick={() =>
            void w.navigation.openTarget({
              kind: "panel",
              panel: { kind: "placement", extensionId: "tools", id: "editor" },
              resource,
              open: "preview",
              region: "main",
            })
          }
        >
          Open as panel
        </Button>
      </Stack>
      <WorkbenchStory workbench={w} />
    </Stack>
  );
};
const meta = {
  title: "pstdio-workbench/Journeys/Editor reuse",
  component: Journey,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Journey>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RetainedDraft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Open note$/ }));
    const draft = await canvas.findByRole("textbox", { name: "Unsaved draft" });
    await userEvent.clear(draft);
    await userEvent.type(draft, "Keep this unsaved draft");
    for (const tray of ["Side", "Bottom", "Main"]) {
      await userEvent.click(canvas.getByRole("button", { name: `Move to ${tray}` }));
      await userEvent.click(canvas.getByRole("button", { name: "Open through another tool" }));
      await expect(canvas.getAllByRole("textbox", { name: "Unsaved draft", hidden: true })).toHaveLength(1);
      await expect(canvas.getByRole("textbox", { name: "Unsaved draft" })).toBe(draft);
      await expect(draft).toHaveValue("Keep this unsaved draft");
      await userEvent.click(canvas.getByRole("button", { name: "Open as panel" }));
      await expect(canvas.getByRole("textbox", { name: "Unsaved draft" })).toBe(draft);
      await expect(draft).toHaveValue("Keep this unsaved draft");
    }
  },
};
