import { Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
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
  workbench.pageLocations.setProject("preview-page-content");
  workbench.pageLocations.navigate({ kind: "page", page });
  const tab = workbench.layout.getActivePanel("main")!;
  if (empty === "moved") workbench.movePanel(tab.instanceId, "side");
  else if (empty) workbench.closePlacement(tab.placementIdentity!);
  return workbench;
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Page content",
  component: WorkbenchStory,
  fullscreen: true,
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const SinglePageTab: Story = {
  id: "pstdio-workbench-reference-core-api-page-content--single-page-tab",
  args: { workbench: createPageWorkbench() },
};
export const SingleViewPage: Story = {
  id: "pstdio-workbench-reference-core-api-page-content--single-view-page",
  args: { workbench: createPageWorkbench(undefined, true, "page") },
};
export const PageHeaderDefault: Story = {
  id: "pstdio-workbench-reference-core-api-page-content--page-header-default",
  args: { workbench: createPageWorkbench(undefined, false) },
};
export const ReopenContent: Story = {
  id: "pstdio-workbench-reference-core-api-page-content--reopen-content",
  args: { workbench: createPageWorkbench("closed") },
};
export const MoveContentBack: Story = {
  id: "pstdio-workbench-reference-core-api-page-content--move-content-back",
  args: { workbench: createPageWorkbench("moved") },
};
export const CustomEmptyView: Story = {
  id: "pstdio-workbench-reference-core-api-page-content--custom-empty-view",
  args: { workbench: createPageWorkbench("custom") },
};
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
  workbench.pageLocations.setProject("preview-filtered-empty");
  workbench.pageLocations.navigate({ kind: "page", page, params: { filter: "route-filter" } });
  return workbench;
};
export const FilteredEmptyView: Story = {
  id: "pstdio-workbench-reference-core-api-page-content--filtered-empty-view",
  args: { workbench: createFilteredEmptyWorkbench() },
};
export const ClosedMovedContent: Story = {
  id: "pstdio-workbench-reference-core-api-page-content--closed-moved-content",
  args: { workbench: createPageWorkbench("moved") },
};
