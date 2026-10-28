import type { Meta, StoryObj } from "@storybook/react";
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
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

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
  name: "Static placement",
  parameters: sourceParameters(staticPlacementSource),
  render: () => <StaticPlacementExample />,
};

export const ResourceTabs: Story = {
  name: "Resource placement (many)",
  parameters: sourceParameters(resourceTabsSource),
  render: () => <ResourceTabsExample />,
};

export const ResourceRebind: Story = {
  name: "Resource placement (one)",
  parameters: sourceParameters(resourceRebindSource),
  render: () => <ResourceRebindExample />,
};

export const TabPresentation: Story = {
  name: "Tab presentation",
  parameters: sourceParameters(tabPresentationSource),
  render: () => <TabPresentationExample />,
};

export const PageReplacement: Story = {
  name: "Page replacement",
  parameters: sourceParameters(pageCompositionSource),
  render: () => <PageReplacementExample />,
};
