import { Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench, workbenchTopHeaderTrailingMenuPath } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";

const page = { kind: "page", extensionId: "storybook", id: "library" } as const;
const artifact = { type: "artifact", id: "prototype", extensionId: "storybook", projectId: "storybook" };
const openArtifact = (workbench: ReturnType<typeof createWorkbench>) =>
  workbench.navigation.openTarget({
    kind: "panel",
    panel: { kind: "page-slot", page, id: "artifact" },
    resource: artifact,
    open: "pin",
  });
const createHeaderWorkbench = () => {
  const workbench = createWorkbench({ startPage: page });
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.views.registerView({
    id: "library",
    title: "Library",
    body: { kind: "react", render: () => <Text p="md">Library and artifact tabs share the same view.</Text> },
  });
  workbench.pages.registerPage({
    id: "library",
    ref: page,
    path: "library",
    modeId: "project",
    main: { kind: "panels", empty: { kind: "view", id: "library" } },
    slots: [
      {
        id: "library",
        region: "main",
        item: { kind: "view", view: { kind: "view", id: "library" }, presence: "fixed" },
      },
      {
        id: "artifact",
        region: "main",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "artifact" }],
            view: { kind: "view", id: "library" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  workbench.commands.registerCommand(
    { id: "related", label: "Related resources" },
    {
      execute: () => undefined,
      isVisible: () => Boolean(workbench.getActiveResource()),
    },
  );
  workbench.layout.registerMenuItem(workbenchTopHeaderTrailingMenuPath, { commandId: "related", group: "primary" });
  workbench.pageLocations.setProject("storybook");
  workbench.pageLocations.navigate({ kind: "page", page });
  return workbench;
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Header actions",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FocusedResourceInLibrary: Story = {
  args: { workbench: createHeaderWorkbench() },
  render: (args) => (
    <WorkbenchThemeProvider>
      <Stack gap="sm">
        <Button onClick={() => void openArtifact(args.workbench)}>Open artifact tab</Button>
        <WorkbenchStory {...args} />
      </Stack>
    </WorkbenchThemeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Related resources" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Open artifact tab" }));
    await expect(await canvas.findByRole("button", { name: "Related resources" })).toBeVisible();
    const library = canvas.getAllByRole("tab", { name: "Library" })[0];
    await userEvent.click(library!);
    await expect(canvas.queryByRole("button", { name: "Related resources" })).toBeNull();
  },
};
