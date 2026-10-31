import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../workbench-story";
import { createDataTableRendererStoryModule } from "./module";
import { createPagedTableStoryModule } from "./paged-module";

const workbench = createWorkbench();
workbench.registerModule(createDataTableRendererStoryModule());
const meta = {
  title: "pstdio-workbench/Reference/Core API/Native data table",
  component: WorkbenchStory,
  args: { workbench },
  description:
    "The Core API registration used by the host adapter for the native data table. Extension authors declare the dataTable view body shown in Extension onboarding.",
  fullscreen: true,
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const MultipleSelection: Story = {
  id: "pstdio-workbench-reference-core-api-native-data-table--multiple-selection",
  name: "Multiple selection",
  description: "Select services and run the contribution's bulk restart action from the selection toolbar.",
};
const emptyWorkbench = createWorkbench();
emptyWorkbench.registerModule(createDataTableRendererStoryModule(true));
export const EmptyWithAction: Story = {
  id: "pstdio-workbench-reference-core-api-native-data-table--empty-with-action",
  name: "Empty table with primary action",
  args: { workbench: emptyWorkbench },
};
const discoveredWorkbench = createWorkbench();
discoveredWorkbench.registerModule(createPagedTableStoryModule(true));
export const DiscoveredPageColumns: Story = {
  id: "pstdio-workbench-reference-core-api-native-data-table--discovered-page-columns",
  name: "Paged table with discovered columns",
  args: { workbench: discoveredWorkbench },
};
const groupedWorkbench = createWorkbench();
groupedWorkbench.registerModule(createPagedTableStoryModule(false));
export const CollapsiblePageGroups: Story = {
  id: "pstdio-workbench-reference-core-api-native-data-table--collapsible-page-groups",
  name: "Paged groups retain expand controls",
  args: { workbench: groupedWorkbench },
};
