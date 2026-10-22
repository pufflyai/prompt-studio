import { Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
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
  parameters: { layout: "fullscreen" },
  args: { modeLabel: "Project", showHeader: true },
} satisfies Meta<typeof ModeReturnStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Project: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole("button", { name: args.modeLabel });
    await expect(button).toBeVisible();
    await expect(button.closest('[draggable="true"]')).toBeNull();
    if (args.showHeader) {
      const pinned = await canvas.findByRole("option", { name: "Pinned note" });
      await expect(button.getBoundingClientRect().top).toBeGreaterThanOrEqual(pinned.getBoundingClientRect().bottom);
    }
    const viewport = button.closest('[data-scope="scroll-area"][data-part="viewport"]');
    await expect(viewport).not.toBeNull();
    const first = await canvas.findByRole("option", { name: "File 1" });
    const second = await canvas.findByRole("option", { name: "File 2" });
    const bounds = button.getBoundingClientRect();
    await expect(first.closest('[data-scope="scroll-area"][data-part="viewport"]')).toBe(viewport);
    const firstBounds = first.getBoundingClientRect();
    const secondBounds = second.getBoundingClientRect();
    await expect(bounds.x).toBe(firstBounds.x);
    await expect(bounds.width).toBe(firstBounds.width);
    await expect(bounds.height).toBe(firstBounds.height);
    await expect(firstBounds.top - bounds.bottom).toBe(secondBounds.top - firstBounds.bottom);
    await userEvent.click(button);
    await expect(await within(canvas.getByRole("main")).findByText("home", { exact: true })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: args.modeLabel })).toBeNull();
  },
};
export const RenamedMode: Story = { args: { modeLabel: "Workspace" }, play: Project.play };
export const WithoutHeaderItems: Story = { args: { showHeader: false }, play: Project.play };
