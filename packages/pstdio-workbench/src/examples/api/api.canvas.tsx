import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { PageReplacementExample } from "../page-composition/module";
import pageCompositionSource from "../page-composition/module.tsx?raw";
import { ResourceRebindExample } from "./resource-rebind-example";
import resourceRebindSource from "./resource-rebind-example.tsx?raw";
import { ResourceTabsExample } from "./resource-tabs-example";
import resourceTabsSource from "./resource-tabs-example.tsx?raw";
import { StaticPlacementExample } from "./static-placement-example";
import staticPlacementSource from "./static-placement-example.tsx?raw";
import { TabPresentationExample } from "./tab-presentation-example";
import tabPresentationSource from "./tab-presentation-example.tsx?raw";

const meta = {
  title: "pstdio-workbench/Guides/Panels and pages",
  tags: ["!dev"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "This Core API guide explains static and resource placements, then shows complete page replacement.",
      },
    },
  },
} satisfies CanvasMeta;
export default meta;
type Story = CanvasVariant<typeof meta>;
const sourceParameters = (code: string) => ({
  docs: {
    source: {
      code,
      language: "tsx",
      type: "code",
    },
  },
});
export const StaticPlacement: Story = {
  id: "pstdio-workbench-guides-panels-and-pages--static-placement",
  name: "Static placement",
  parameters: sourceParameters(staticPlacementSource),
  render: () => <StaticPlacementExample />,
};
export const ResourceTabs: Story = {
  id: "pstdio-workbench-guides-panels-and-pages--resource-tabs",
  name: "Resource placement (many)",
  parameters: sourceParameters(resourceTabsSource),
  render: () => <ResourceTabsExample />,
};
export const ResourceRebind: Story = {
  id: "pstdio-workbench-guides-panels-and-pages--resource-rebind",
  name: "Resource placement (one)",
  parameters: sourceParameters(resourceRebindSource),
  render: () => <ResourceRebindExample />,
};
export const TabPresentation: Story = {
  id: "pstdio-workbench-guides-panels-and-pages--tab-presentation",
  name: "Tab presentation",
  parameters: sourceParameters(tabPresentationSource),
  render: () => <TabPresentationExample />,
};
export const PageReplacement: Story = {
  id: "pstdio-workbench-guides-panels-and-pages--page-replacement",
  name: "Page replacement",
  parameters: sourceParameters(pageCompositionSource),
  render: () => <PageReplacementExample />,
};
