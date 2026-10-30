import { Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWorkbench, resourceContextMenuPath, workbenchTopHeaderTrailingMenuPath } from "../../core";
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
        tab: { getSnapshot: () => ({ label: "Preview" }) },
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
    { id: "publish-artifact", label: "Publish artifact" },
    {
      execute: () => undefined,
      isVisible: () => Boolean(workbench.getActiveResource()),
    },
  );
  workbench.layout.registerMenuItem(workbenchTopHeaderTrailingMenuPath, {
    commandId: "publish-artifact",
    group: "primary",
  });
  workbench.commands.registerCommand({ id: "rename-artifact", label: "Rename artifact" }, { execute: () => undefined });
  workbench.layout.registerMenuItem(resourceContextMenuPath("artifact"), { commandId: "rename-artifact" });
  workbench.pageLocations.setProject("storybook");
  workbench.pageLocations.navigate({ kind: "page", page });
  return workbench;
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Header actions",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const FocusedResourceInLibrary: Story = {
  id: "pstdio-workbench-reference-core-api-header-actions--focused-resource-in-library",
  args: { workbench: createHeaderWorkbench() },
  render: (args) => (
    <WorkbenchThemeProvider>
      <Stack gap="sm">
        <Button onClick={() => void openArtifact(args.workbench)}>Open artifact tab</Button>
        <WorkbenchStory {...args} />
      </Stack>
    </WorkbenchThemeProvider>
  ),
};
export const BreadcrumbActionsForFocusedResource: Story = {
  id: "pstdio-workbench-reference-core-api-header-actions--breadcrumb-actions-for-focused-resource",
  ...FocusedResourceInLibrary,
  args: { workbench: createHeaderWorkbench() },
};
