import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { PageReplacementExample } from "../page-composition/module";
import { ResourceRebindExample } from "./resource-rebind-example";
import { ResourceTabsExample } from "./resource-tabs-example";
import { StaticPlacementExample } from "./static-placement-example";
import { TabPresentationExample } from "./tab-presentation-example";

const meta = {
  title: "pstdio-workbench/Guides/Panels and pages",
  description: "This Core API guide explains static and resource placements, then shows complete page replacement.",
} satisfies CanvasMeta;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const StaticPlacement: Story = {
  id: "pstdio-workbench-guides-panels-and-pages--static-placement",
  name: "Static placement",
  render: () => <StaticPlacementExample />,
};
export const ResourceTabs: Story = {
  id: "pstdio-workbench-guides-panels-and-pages--resource-tabs",
  name: "Resource placement (many)",
  render: () => <ResourceTabsExample />,
};
export const ResourceRebind: Story = {
  id: "pstdio-workbench-guides-panels-and-pages--resource-rebind",
  name: "Resource placement (one)",
  render: () => <ResourceRebindExample />,
};
export const TabPresentation: Story = {
  id: "pstdio-workbench-guides-panels-and-pages--tab-presentation",
  name: "Tab presentation",
  render: () => <TabPresentationExample />,
};
export const PageReplacement: Story = {
  id: "pstdio-workbench-guides-panels-and-pages--page-replacement",
  name: "Page replacement",
  render: () => <PageReplacementExample />,
};
