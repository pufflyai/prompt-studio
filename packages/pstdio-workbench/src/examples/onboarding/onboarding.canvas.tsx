import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
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
import navigationLevelsExtension, { pantryPage } from "./extensions/navigation-levels-extension";
import navigationLevelsSource from "./extensions/navigation-levels-extension.ts?raw";
import pageExtension, { guidePage } from "./extensions/page-extension";
import firstExtensionSource from "./extensions/page-extension.ts?raw";
import { OnboardingFrame } from "./onboarding-frame";

const meta = {
  title: "pstdio-workbench/Guides/Onboarding",
  tags: ["!dev"],
  parameters: { layout: "padded" },
} satisfies CanvasMeta;
export default meta;
type Story = CanvasVariant<typeof meta>;
const createModuleWorkbench = (createModule: () => WorkbenchModuleContribution) => {
  const workbench = createWorkbench();
  workbench.registerModule(createModule());
  return workbench;
};
const storyDescription = (description: string) => ({
  docs: { description: { story: description } },
});
export const EmptyWorkbench: Story = {
  id: "pstdio-workbench-guides-onboarding--empty-workbench",
  name: "0. Empty workbench",
  parameters: storyDescription("The shell before any module contributes content."),
  render: () => <OnboardingFrame createWorkbench={createEmptyWorkbench} />,
};
export const Placeholder: Story = {
  id: "pstdio-workbench-guides-onboarding--placeholder",
  name: "1. Placeholder",
  parameters: storyDescription("A region placeholder supplies a useful empty state."),
  render: () => <OnboardingFrame createWorkbench={createPlaceholderWorkbench} />,
};
export const Views: Story = {
  id: "pstdio-workbench-guides-onboarding--views",
  name: "2. Views",
  parameters: storyDescription("A View defines reusable content. A placement puts it in Main."),
  render: () => <OnboardingFrame createWorkbench={createViewsWorkbench} />,
};
export const FirstExtensionPage: Story = {
  id: "pstdio-workbench-guides-onboarding--first-extension-page",
  name: "3. First extension page",
  parameters: {
    docs: {
      description: { story: "Declare a native View, place it on a page, and expose the page in navigation." },
      source: { code: firstExtensionSource, language: "tsx", type: "code" },
    },
  },
  render: () => <OnboardingFrame createWorkbench={() => createExtensionPreview(pageExtension, guidePage.id)} />,
};
export const CommandAndMenu: Story = {
  id: "pstdio-workbench-guides-onboarding--command-and-menu",
  name: "4. Command and menu",
  parameters: storyDescription("Global header commands open and close a panel."),
  render: () => <OnboardingFrame createWorkbench={createCommandWorkbench} />,
};
export const TreeRenderer: Story = {
  id: "pstdio-workbench-guides-onboarding--tree-renderer",
  name: "5. Tree navigation",
  parameters: storyDescription("Tree rows run commands across pinned header, scrolling content, and pinned footer."),
  render: () => <OnboardingFrame createWorkbench={createTreeWorkbench} />,
};
export const ResourceBackedPanel: Story = {
  id: "pstdio-workbench-guides-onboarding--resource-backed-panel",
  name: "6. Resource-backed panel",
  parameters: storyDescription("Open several guides through one resource placement, including its Add-panel action."),
  render: () => <OnboardingFrame createWorkbench={createResourceWorkbench} />,
};
export const ModeContribution: Story = {
  id: "pstdio-workbench-guides-onboarding--mode-contribution",
  name: "7. Mode and page contributions",
  parameters: storyDescription("Switch between a project, its ticket list, and a live session to see both owners."),
  render: () => <OnboardingFrame createWorkbench={createModeContributionWorkbench} />,
};
export const PageComposition: Story = {
  id: "pstdio-workbench-guides-onboarding--page-composition",
  name: "8. Page composition",
  parameters: storyDescription("Compare a full-height Side layout with a bottom Secondary layout."),
  render: () => <PageCompositionExample />,
};
export const PageReplacement: Story = {
  id: "pstdio-workbench-guides-onboarding--page-replacement",
  name: "9. Page replacement",
  parameters: storyDescription("Page navigation replaces the old content and panel geometry in one step."),
  render: () => <PageReplacementExample />,
};
export const ResourceReuse: Story = {
  id: "pstdio-workbench-guides-onboarding--resource-reuse",
  name: "10. Resource cardinality: one and many",
  parameters: storyDescription("Compare one replaceable inspector with several pinned and preview document tabs."),
  render: () => <ResourceTabsExample showCardinalityComparison />,
};
export const Breadcrumbs: Story = {
  id: "pstdio-workbench-guides-onboarding--breadcrumbs",
  name: "11. Breadcrumbs",
  parameters: storyDescription("A five-level trail lets each ancestor return to that location."),
  render: () => <OnboardingFrame createWorkbench={createBreadcrumbWorkbench} />,
};
export const WorkbenchRegions: Story = {
  id: "pstdio-workbench-guides-onboarding--workbench-regions",
  name: "12. Workbench regions",
  render: () => <OnboardingFrame createWorkbench={() => createModuleWorkbench(createRegionMapModule)} />,
};
export const Settings: Story = {
  id: "pstdio-workbench-guides-onboarding--settings",
  name: "13. Settings",
  render: () => <OnboardingFrame createWorkbench={() => createModuleWorkbench(createSettingsModule)} />,
};
export const PreferenceSchemas: Story = {
  id: "pstdio-workbench-guides-onboarding--preference-schemas",
  name: "14. Preference schemas",
  render: () => <OnboardingFrame createWorkbench={() => createModuleWorkbench(createPreferenceSchemasExampleModule)} />,
};
export const LayoutScopes: Story = {
  id: "pstdio-workbench-guides-onboarding--layout-scopes",
  name: "15. Layout scopes",
  render: () => <OnboardingFrame createWorkbench={createLayoutScopeExampleWorkbench} />,
};
export const HostTerminal: Story = {
  id: "pstdio-workbench-guides-onboarding--host-terminal",
  name: "16. Host terminal",
  parameters: storyDescription("Open as many scripted terminal tabs as needed from the launcher or Add panel."),
  render: () => <OnboardingFrame createWorkbench={createHostTerminalWorkbench} />,
};
export const SidenavLevels: Story = {
  id: "pstdio-workbench-guides-onboarding--sidenav-levels",
  name: "17. Sidenav levels",
  parameters: {
    docs: {
      description: { story: "A page-owned navigation tree replaces the Sidenav body while header rows stay." },
      source: { code: navigationLevelsSource, language: "tsx", type: "code" },
    },
  },
  render: () => (
    <OnboardingFrame createWorkbench={() => createExtensionPreview(navigationLevelsExtension, pantryPage.id)} />
  ),
};
