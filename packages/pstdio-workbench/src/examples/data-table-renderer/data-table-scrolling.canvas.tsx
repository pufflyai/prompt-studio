import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../workbench-story";

const workbench = createWorkbench();
workbench.registerModule({
  id: "table-scrolling",
  activate(ctx) {
    ctx.views.registerView({
      id: "table-scrolling.rows",
      title: "Workspaces",
      body: {
        kind: "dataTable",
        columns: [{ id: "name", label: "Workspace", type: "string" }],
        initialPageSize: 50,
        defaultFilter: {
          conjunction: "and",
          rules: [{ attributeId: "name", condition: "contains", value: "Workspace" }],
        },
        executeQuery: () => ({
          rows: Array.from({ length: 53 }, (_, index) => ({
            id: `workspace-${index + 1}`,
            values: { name: `Workspace ${index + 1}` },
          })),
        }),
      },
    });
    ctx.shellPlacements.registerPlacement({
      id: "table-scrolling.rows",
      region: "main",
      item: { kind: "view", presence: "fixed", view: { kind: "view", id: "table-scrolling.rows" } },
    });
  },
});
const meta = {
  title: "pstdio-workbench/Reference/Core API/Native data table scrolling",
  component: WorkbenchStory,
  args: { workbench },
  fullscreen: true,
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const PinnedChrome: Story = {
  id: "pstdio-workbench-reference-core-api-native-data-table-scrolling--pinned-chrome",
};
