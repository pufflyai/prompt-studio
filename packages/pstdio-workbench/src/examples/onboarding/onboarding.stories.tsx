import type { Meta, StoryObj } from "@storybook/react";
import { createWorkbench, type WorkbenchModuleContribution } from "../../core";
import { ResourceTabsExample } from "../api/resource-tabs-example";
import { createHostTerminalWorkbench } from "../host-terminal-story";
import { createLayoutScopeExampleWorkbench } from "../layout-scope/module";
import { PageCompositionExample, PageReplacementExample } from "../page-composition/module";
import { createPreferenceSchemasExampleModule } from "../preferences/module";
import { createRegionMapModule } from "../region-map/module";
import { createSettingsModule } from "../settings/module";
import { createBreadcrumbWorkbench } from "./core/breadcrumbs";
import { createCommandWorkbench } from "./core/command-menu";
import { createEmptyWorkbench } from "./core/empty-workbench";
import { createModeContributionWorkbench } from "./core/mode-page";
import { createPlaceholderWorkbench } from "./core/placeholder";
import { createResourceWorkbench } from "./core/resource-panel";
import { createTreeWorkbench } from "./core/tree-renderer";
import { createViewsWorkbench } from "./core/views";
import { createExtensionPreview } from "./extension-preview";
import treePageExtension, { guidePage } from "./extensions/tree-page-extension";
import firstExtensionSource from "./extensions/tree-page-extension.ts?raw";
import { OnboardingFrame } from "./onboarding-frame";

const meta = {
  title: "pstdio-workbench/Guides/Onboarding",
  tags: ["!dev"],
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const createModuleWorkbench = (createModule: () => WorkbenchModuleContribution) => {
  const workbench = createWorkbench();
  workbench.registerModule(createModule());
  return workbench;
};

const storyDescription = (description: string) => ({
  docs: { description: { story: description } },
});

export const EmptyWorkbench: Story = {
  name: "0. Empty workbench",
  parameters: storyDescription("The shell before any module contributes content."),
  render: () => <OnboardingFrame createWorkbench={createEmptyWorkbench} />,
};

export const Placeholder: Story = {
  name: "1. Placeholder",
  parameters: storyDescription("A region placeholder supplies a useful empty state."),
  render: () => <OnboardingFrame createWorkbench={createPlaceholderWorkbench} />,
};

export const Views: Story = {
  name: "2. Views",
  parameters: storyDescription("A View defines reusable content. A placement puts it in Main."),
  render: () => <OnboardingFrame createWorkbench={createViewsWorkbench} />,
};

export const FirstExtensionPage: Story = {
  name: "3. First extension page",
  parameters: {
    docs: {
      description: { story: "Declare a native View, place it on a page, and expose the page in navigation." },
      source: { code: firstExtensionSource, language: "tsx", type: "code" },
    },
  },
  render: () => <OnboardingFrame createWorkbench={() => createExtensionPreview(treePageExtension, guidePage.id)} />,
};

export const CommandAndMenu: Story = {
  name: "4. Command and menu",
  parameters: storyDescription("Global header commands open and close a panel."),
  render: () => <OnboardingFrame createWorkbench={createCommandWorkbench} />,
};

export const TreeRenderer: Story = {
  name: "5. Tree navigation",
  parameters: storyDescription("Tree rows run commands across pinned header, scrolling content, and pinned footer."),
  render: () => <OnboardingFrame createWorkbench={createTreeWorkbench} />,
};

export const ResourceBackedPanel: Story = {
  name: "6. Resource-backed panel",
  parameters: storyDescription("Open several guides through one resource placement, including its Add-panel action."),
  render: () => <OnboardingFrame createWorkbench={createResourceWorkbench} />,
};

export const ModeContribution: Story = {
  name: "7. Mode and page contributions",
  parameters: storyDescription("Switch between a project, its ticket list, and a live session to see both owners."),
  render: () => <OnboardingFrame createWorkbench={createModeContributionWorkbench} />,
};

export const PageComposition: Story = {
  name: "8. Page composition",
  parameters: storyDescription("Compare a full-height Side layout with a bottom Secondary layout."),
  render: () => <PageCompositionExample />,
};

export const PageReplacement: Story = {
  name: "9. Page replacement",
  parameters: storyDescription("Page navigation replaces the old content and panel geometry in one step."),
  render: () => <PageReplacementExample />,
};

export const ResourceReuse: Story = {
  name: "10. Resource cardinality: one and many",
  parameters: storyDescription("Compare one replaceable inspector with several pinned and preview document tabs."),
  render: () => <ResourceTabsExample showCardinalityComparison />,
};

export const Breadcrumbs: Story = {
  name: "11. Breadcrumbs",
  parameters: storyDescription("A five-level trail lets each ancestor return to that location."),
  render: () => <OnboardingFrame createWorkbench={createBreadcrumbWorkbench} />,
};

export const WorkbenchRegions: Story = {
  name: "12. Workbench regions",
  render: () => <OnboardingFrame createWorkbench={() => createModuleWorkbench(createRegionMapModule)} />,
};

export const Settings: Story = {
  name: "13. Settings",
  render: () => <OnboardingFrame createWorkbench={() => createModuleWorkbench(createSettingsModule)} />,
};

export const PreferenceSchemas: Story = {
  name: "14. Preference schemas",
  render: () => <OnboardingFrame createWorkbench={() => createModuleWorkbench(createPreferenceSchemasExampleModule)} />,
};

export const LayoutScopes: Story = {
  name: "15. Layout scopes",
  render: () => <OnboardingFrame createWorkbench={createLayoutScopeExampleWorkbench} />,
};

export const HostTerminal: Story = {
  name: "16. Host terminal",
  parameters: storyDescription("Open as many scripted terminal tabs as needed from the launcher or Add panel."),
  render: () => <OnboardingFrame createWorkbench={createHostTerminalWorkbench} />,
};
