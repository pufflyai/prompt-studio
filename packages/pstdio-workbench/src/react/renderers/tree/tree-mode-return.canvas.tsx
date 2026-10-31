import { Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createLevelNavigation, createWorkbench } from "../../../core";
import { WorkbenchStory } from "../../../examples/workbench-story";

const createFixture = (modeLabel: string, showHeader: boolean) => {
  const workbench = createWorkbench();
  const navigation = createLevelNavigation(workbench);
  const pageRef = (id: string) => ({ kind: "page" as const, extensionId: "story", id });
  workbench.modes.registerMode({ id: "project", label: modeLabel, activate() {} });
  for (const id of ["home", "details"]) {
    workbench.views.registerView({ id, title: id, body: { kind: "react", render: () => <Text p="md">{id}</Text> } });
    workbench.pages.registerPage({
      id,
      ref: pageRef(id),
      title: id,
      path: id,
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id }, cardinality: "one" },
      slots: [],
    });
  }
  workbench.navigationTrees.registerContribution({
    id: "header",
    owner: { kind: "mode", extensionId: "pstdio", id: "project" },
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    slot: "header",
    getSections: () => [
      {
        id: "header",
        nodes: showHeader
          ? [
              { id: "search", label: "Search", icon: "Search" },
              { id: "pinned", label: "Pinned note", icon: "FileText" },
            ]
          : [],
      },
    ],
  });
  workbench.navigationTrees.registerContribution({
    id: "details",
    owner: { kind: "page", extensionId: "story", id: "details" },
    sourceExtensionId: "story",
    declarationIndex: 0,
    getSections: () => [
      {
        id: "files",
        nodes: Array.from({ length: 60 }, (_, index) => ({
          id: `file-${index}`,
          label: `File ${index + 1}`,
          icon: "FileText",
        })),
      },
    ],
  });
  workbench.views.registerView({
    id: "navigation",
    title: "Navigation",
    body: {
      kind: "tree",
      getReadKey: () => navigation.getReadKey(),
      getHeader: (context) => navigation.getSections("header", context.signal, context.onProgress),
      getBody: (context) => navigation.getSections("content", context.signal, context.onProgress),
      getChildren: () => [],
      defaultExpandedSectionIds: ["files"],
    },
  });
  workbench.pages.store.subscribeSelector(
    (state) => state.location,
    () => workbench.views.refreshView("navigation"),
  );
  workbench.shellPlacements.registerPlacement({
    id: "navigation",
    region: "sidenav",
    item: { kind: "view", presence: "fixed", view: { kind: "view", id: "navigation" } },
  });
  workbench.pageLocations.setProject("story");
  workbench.pageLocations.navigate({ kind: "page", page: pageRef("home") });
  workbench.pageLocations.navigate({ kind: "page", page: pageRef("details") });
  return workbench;
};
const ModeReturnStory = (props: { modeLabel: string; showHeader: boolean }) => {
  const { modeLabel, showHeader } = props;
  const [workbench] = useState(() => createFixture(modeLabel, showHeader));
  return <WorkbenchStory workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Guides/Fixed mode return",
  component: ModeReturnStory,
  fullscreen: true,
  args: { modeLabel: "Project", showHeader: true },
} satisfies CanvasMeta<typeof ModeReturnStory>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Project: Story = {
  id: "pstdio-workbench-guides-fixed-mode-return--project",
};
export const RenamedMode: Story = {
  id: "pstdio-workbench-guides-fixed-mode-return--renamed-mode",
  args: { modeLabel: "Workspace" },
};
export const WithoutHeaderItems: Story = {
  id: "pstdio-workbench-guides-fixed-mode-return--without-header-items",
  args: { showHeader: false },
};
export const KeyboardReturn: Story = {
  id: "pstdio-workbench-guides-fixed-mode-return--keyboard-return",
};
export const GoToProject: Story = {
  id: "pstdio-workbench-guides-fixed-mode-return--go-to-project",
};
