import { Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createPageWorkbench = (
  empty?: "closed" | "moved" | "custom",
  showHeader = true,
  presentation: "page" | "tabs" = "tabs",
) => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "page", activate() {}, regionSettings: { main: { showHeader: false } } });
  for (const [id, title] of [
    ["editor", "Document"],
    ["empty", "Choose a document"],
  ]) {
    workbench.views.registerView({
      id,
      title,
      body: { kind: "react", render: () => <Text p="md">{title} content</Text> },
    });
  }
  const page = { kind: "page" as const, extensionId: "example", id: "document" };
  workbench.pages.registerPage({
    id: "document",
    ref: page,
    title: "Document",
    path: "document",
    modeId: "page",
    regionSettings: { main: { showHeader } },
    main: {
      kind: "view",
      view: { kind: "view", id: "editor" },
      cardinality: "one",
      presentation,
      ...(empty === "custom" ? { empty: { kind: "view" as const, id: "empty" } } : {}),
    },
    slots: [],
  });
  workbench.pageLocations.setProject("storybook-page-content");
  workbench.pageLocations.navigate({ kind: "page", page });
  const tab = workbench.layout.getActivePanel("main")!;
  if (empty === "moved") workbench.movePanel(tab.instanceId, "side");
  else if (empty) workbench.closePlacement(tab.placementIdentity!);
  return workbench;
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Page content",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SinglePageTab: Story = { args: { workbench: createPageWorkbench() } };
export const SingleViewPage: Story = {
  tags: ["page-header-policy"],
  args: { workbench: createPageWorkbench(undefined, true, "page") },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Document content")).toBeVisible();
    await expect(canvas.queryByLabelText("Main panel header")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("tab")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Add panel" })).not.toBeInTheDocument();
    expect(args.workbench.layout.getLayout().regions.main.widgets).toEqual([]);
    expect(args.workbench.pages.getContent()?.viewId).toBe("editor");
    const original = canvas.getByText("Document content");
    args.workbench.views.registerView({
      id: "other",
      title: "Other",
      body: { kind: "react", render: () => <Text p="md">Other content</Text> },
    });
    const other = { kind: "page", extensionId: "example", id: "other" } as const;
    args.workbench.pages.registerPage({
      id: "other",
      ref: other,
      modeId: "page",
      path: "other",
      main: { kind: "view", view: { kind: "view", id: "other" }, cardinality: "one", presentation: "page" },
      slots: [],
    });
    args.workbench.pageLocations.navigate({ kind: "page", page: other });
    await expect(await canvas.findByText("Other content")).toBeVisible();
    await expect(original).not.toBeVisible();
    args.workbench.pageLocations.navigate({
      kind: "page",
      page: { kind: "page", extensionId: "example", id: "document" },
    });
    await expect(await canvas.findByText("Document content")).toBeVisible();
    expect(canvas.getByText("Document content")).toBe(original);
  },
};
export const PageHeaderDefault: Story = {
  tags: ["page-header-policy"],
  args: { workbench: createPageWorkbench(undefined, false) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText("Main panel header")).toBeVisible();
    await expect(canvas.getByRole("tab", { name: "Document" })).toBeVisible();
  },
};
export const ReopenContent: Story = {
  args: { workbench: createPageWorkbench("closed") },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      within(await canvas.findByRole("group", { name: "Available tabs" })).getByRole("button", { name: "Document" }),
    );
    await expect(canvas.getByRole("tab", { name: "Document" })).toBeVisible();
    await expect(canvas.getByText("Document content")).toBeVisible();
  },
};
export const MoveContentBack: Story = {
  args: { workbench: createPageWorkbench("moved") },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const original = args.workbench.layout.getActivePanel("side")!.instanceId;
    await userEvent.click(
      within(await canvas.findByRole("group", { name: "Available tabs" })).getByRole("button", { name: "Document" }),
    );
    expect(args.workbench.layout.getActivePanel("main")!.instanceId).toBe(original);
    expect(args.workbench.layout.listPanelInstances("side")).toEqual([]);
  },
};
export const CustomEmptyView: Story = { args: { workbench: createPageWorkbench("custom") } };

const createFilteredEmptyWorkbench = () => {
  const workbench = createWorkbench();
  const page = { kind: "page", extensionId: "example", id: "collection" } as const;
  workbench.modes.registerMode({ id: "page", activate() {} });
  workbench.views.registerView({
    id: "empty-tree",
    title: "Filtered empty content",
    body: {
      kind: "tree",
      getBody: ({ pageParams }) => [
        { id: "filter", nodes: [{ id: "result", label: String(pageParams?.filter ?? "Missing filter") }] },
      ],
      getChildren: () => [],
    },
  });
  workbench.pages.registerPage({
    id: page.id,
    ref: page,
    modeId: "page",
    path: "collection",
    params: { filter: { type: "string", default: "default-filter" } },
    main: { kind: "panels", empty: { kind: "view", id: "empty-tree" } },
    slots: [],
  });
  workbench.pageLocations.setProject("storybook-filtered-empty");
  workbench.pageLocations.navigate({ kind: "page", page, params: { filter: "route-filter" } });
  return workbench;
};

export const FilteredEmptyView: Story = { args: { workbench: createFilteredEmptyWorkbench() } };

export const ClosedMovedContent: Story = {
  args: { workbench: createPageWorkbench("moved") },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const cards = within(await canvas.findByRole("group", { name: "Available tabs" }));
    await expect(cards.getByRole("button", { name: "Document" })).toBeVisible();
    args.workbench.closePlacement(args.workbench.layout.getActivePanel("side")!.placementIdentity!);
    await userEvent.click(cards.getByRole("button", { name: "Document" }));
    await expect(await canvas.findByText("Document content")).toBeVisible();
  },
};
