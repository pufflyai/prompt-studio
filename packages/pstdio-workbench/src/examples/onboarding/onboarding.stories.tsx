import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useWorkbenchThemePreferences, Workbench, WorkbenchThemeProvider } from "../../react";
import { createDataRendererStoryModule } from "../data-renderer/module";
import { createDataTableRendererStoryModule } from "../data-table-renderer/module";
import { createExtensionThemesWorkbench } from "../extension-themes/module";
import { createFileRendererStoryModule } from "../file-renderer/module";
import { createSettingsModule } from "../settings/module";
import type { WorkbenchStoryProps } from "../workbench-story";
import { createBreadcrumbModule } from "./breadcrumb-module";
import { breadcrumbSource } from "./breadcrumb-source";
import { createCommandKeybindingThemeModule } from "./command-theme-module";
import { createControlsRendererModule } from "./controls-renderer-module";
import { controlsRendererSource } from "./controls-renderer-source";
import { dataTableRendererSource } from "./data-table-renderer-source";
import { createExtensionContributionsModule } from "./extension-contributions-module";
import { extensionContributionsSource } from "./extension-contributions-source";
import { extensionsSource } from "./extensions-source";
import { createFocusContextModule } from "./focus-context-module";
import { focusContextSource } from "./focus-context-source";
import {
  createCommandModule,
  createModesModule,
  createPlaceholderModule,
  createResourcesModule,
  createTreeViewsModule,
  createWidgetModule,
  createWorkbench,
} from "./modules";
import { createNavigationModule } from "./navigation-module";
import { navigationSource } from "./navigation-source";
import { createPaletteResourcesModule } from "./palette-resources-module";
import { paletteResourcesSource } from "./palette-resources-source";
import {
  createPanelCompositionWorkbench,
  createProjectIsolatedPanelCompositionWorkbench,
  createRestoredPanelCompositionWorkbench,
} from "./panel-compositions-module";
import { settingsSource } from "./settings-source";
import { createSidePanelsModule } from "./side-panels-module";
import { sidePanelsSource } from "./side-panels-source";
import { onboardingSources } from "./sources";
import { createTreeCustomizationModule } from "./tree-customization-module";
import { treeCustomizationSource } from "./tree-customization-source";
import { createWidgetVariantsModule } from "./widget-variants-module";
import { widgetVariantsSource } from "./widget-variants-source";

const meta = {
  title: "pstdio-workbench/Onboarding",
  parameters: { layout: "padded" },
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

// Onboarding renders the workbench in a bordered, fixed-height frame. The theme
// provider is fed from `workbench.themes` so it wraps the frame too.
const WorkbenchFrame = (props: WorkbenchStoryProps) => {
  const { workbench } = props;
  const themePreferences = useWorkbenchThemePreferences(workbench);

  return (
    <WorkbenchThemeProvider themePreferences={themePreferences}>
      <Box h="520px" minH="360px" borderWidth="1px" borderColor="border.subtle" overflow="hidden">
        <Workbench workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};

const emptyWorkbench = createWorkbench();
const placeholderWorkbench = createWorkbench(createPlaceholderModule());
const widgetWorkbench = createWorkbench(createWidgetModule());
const commandWorkbench = createWorkbench(createCommandModule());
const treeViewsWorkbench = createWorkbench(createTreeViewsModule());
const resourcesWorkbench = createWorkbench(createResourcesModule({ openFirst: true }));
const modesWorkbench = createWorkbench(createModesModule());
const commandKeybindingThemeWorkbench = createWorkbench(createCommandKeybindingThemeModule());
const focusContextWorkbench = createWorkbench(createFocusContextModule());
const navigationWorkbench = createWorkbench(createNavigationModule());
const dataRendererWorkbench = createWorkbench(createDataRendererStoryModule());
const extensionsWorkbench = createExtensionThemesWorkbench();
const widgetVariantsWorkbench = createWorkbench(createWidgetVariantsModule());
const breadcrumbWorkbench = createWorkbench(createBreadcrumbModule());
const sidePanelsWorkbench = createWorkbench(createSidePanelsModule());
sidePanelsWorkbench.sessionPanel.setMode("attached");
const panelCompositionWorkbenches = {
  locationOnly: createPanelCompositionWorkbench("location-only"),
  eligible: createPanelCompositionWorkbench("eligible"),
  open: createPanelCompositionWorkbench("open"),
  menuOnly: createPanelCompositionWorkbench("menu-only"),
  collapsedMenu: createPanelCompositionWorkbench("collapsed-menu"),
  subPanelsMenu: createPanelCompositionWorkbench("sub-panels-menu"),
  allPanels: createPanelCompositionWorkbench("all-panels"),
  locationSwitch: createPanelCompositionWorkbench("location-switch"),
  floatingPanelFree: createPanelCompositionWorkbench("floating-panel-free"),
  crossPanelHistory: createPanelCompositionWorkbench("cross-panel-history"),
  refreshEnd: createRestoredPanelCompositionWorkbench(false),
  refreshAfterBack: createRestoredPanelCompositionWorkbench(true),
  projectIsolation: createProjectIsolatedPanelCompositionWorkbench(),
};
const settingsWorkbench = createWorkbench(createSettingsModule());
const documentRendererWorkbench = createWorkbench(createFileRendererStoryModule());
const treeCustomizationWorkbench = createWorkbench(createTreeCustomizationModule());
const paletteResourcesWorkbench = createWorkbench(createPaletteResourcesModule());
const extensionContributionsWorkbench = createWorkbench(createExtensionContributionsModule());
const controlsRendererWorkbench = createWorkbench(createControlsRendererModule());
const dataTableRendererWorkbench = createWorkbench(createDataTableRendererStoryModule());

export const EmptyWorkbench: Story = {
  name: "0. Empty workbench",
  parameters: sourceParameters(onboardingSources.emptyWorkbench),
  render: () => <WorkbenchFrame workbench={emptyWorkbench} />,
};

export const Placeholder: Story = {
  name: "1. Placeholder",
  parameters: sourceParameters(onboardingSources.placeholder),
  render: () => <WorkbenchFrame workbench={placeholderWorkbench} />,
};

export const RendererAndWidget: Story = {
  name: "2. Renderer and widget",
  parameters: sourceParameters(onboardingSources.rendererAndWidget),
  render: () => <WorkbenchFrame workbench={widgetWorkbench} />,
};

export const CommandAndMenu: Story = {
  name: "3. Command and menu",
  parameters: sourceParameters(onboardingSources.commandAndMenu),
  render: () => <WorkbenchFrame workbench={commandWorkbench} />,
};

export const TreeViews: Story = {
  name: "4. Tree views",
  parameters: sourceParameters(onboardingSources.treeViews),
  render: () => <WorkbenchFrame workbench={treeViewsWorkbench} />,
};

export const Resources: Story = {
  name: "5. Resources",
  parameters: sourceParameters(onboardingSources.resources),
  render: () => <WorkbenchFrame workbench={resourcesWorkbench} />,
};

export const Modes: Story = {
  name: "6. Modes",
  parameters: sourceParameters(onboardingSources.modes),
  render: () => <WorkbenchFrame workbench={modesWorkbench} />,
};

export const CommandsKeybindingsThemes: Story = {
  name: "7. Commands, keybindings, and themes",
  parameters: sourceParameters(onboardingSources.commandsKeybindingsThemes),
  render: () => <WorkbenchFrame workbench={commandKeybindingThemeWorkbench} />,
};

export const FocusAndContext: Story = {
  name: "8. Focus and context",
  parameters: sourceParameters(focusContextSource),
  render: () => <WorkbenchFrame workbench={focusContextWorkbench} />,
};

export const Navigation: Story = {
  name: "9. Navigation",
  parameters: sourceParameters(navigationSource),
  render: () => <WorkbenchFrame workbench={navigationWorkbench} />,
};

export const DataRenderer: Story = {
  name: "10. Data renderer",
  parameters: sourceParameters(onboardingSources.dataRenderer),
  render: () => <WorkbenchFrame workbench={dataRendererWorkbench} />,
};

export const Extensions: Story = {
  name: "11. Extensions",
  parameters: sourceParameters(extensionsSource),
  render: () => <WorkbenchFrame workbench={extensionsWorkbench} />,
};

export const WidgetVariants: Story = {
  name: "12. Widget variants",
  parameters: sourceParameters(widgetVariantsSource),
  render: () => <WorkbenchFrame workbench={widgetVariantsWorkbench} />,
};

export const Breadcrumbs: Story = {
  name: "13. Breadcrumbs",
  parameters: sourceParameters(breadcrumbSource),
  render: () => <WorkbenchFrame workbench={breadcrumbWorkbench} />,
};

export const SidePanels: Story = {
  name: "14. Side panels",
  parameters: sourceParameters(sidePanelsSource),
  render: () => <WorkbenchFrame workbench={sidePanelsWorkbench} />,
};

export const LocationContentOnly: Story = {
  name: "14.1 Location content only",
  render: () => <WorkbenchFrame workbench={panelCompositionWorkbenches.locationOnly} />,
};

export const EligibleSubPanels: Story = {
  name: "14.2 Eligible Sub Panels",
  render: () => <WorkbenchFrame workbench={panelCompositionWorkbenches.eligible} />,
};

export const OpenSubPanels: Story = {
  name: "14.3 Open Sub Panels",
  render: () => <WorkbenchFrame workbench={panelCompositionWorkbenches.open} />,
};

export const PanelMenuOnly: Story = {
  name: "14.4 Panel Menu only",
  render: () => <WorkbenchFrame workbench={panelCompositionWorkbenches.menuOnly} />,
};

export const CollapsedPanelMenu: Story = {
  name: "14.5 Collapsed Panel Menu",
  render: () => <WorkbenchFrame workbench={panelCompositionWorkbenches.collapsedMenu} />,
};

export const SubPanelsWithPanelMenus: Story = {
  name: "14.6 Sub Panels with Panel Menus",
  render: () => <WorkbenchFrame workbench={panelCompositionWorkbenches.subPanelsMenu} />,
};

export const AllThreePanels: Story = {
  name: "14.7 All three Panels",
  render: () => <WorkbenchFrame workbench={panelCompositionWorkbenches.allPanels} />,
};

export const LocationSwitch: Story = {
  name: "14.8 Location switch",
  render: () => <WorkbenchFrame workbench={panelCompositionWorkbenches.locationSwitch} />,
};

export const CrossPanelHistory: Story = {
  name: "14.10 Cross-Panel history",
  render: () => <WorkbenchFrame workbench={panelCompositionWorkbenches.crossPanelHistory} />,
};

export const BubbleFreeLocation: Story = {
  name: "14.9 Bubble-free Location",
  render: () => <WorkbenchFrame workbench={panelCompositionWorkbenches.floatingPanelFree} />,
};

export const RefreshAtTimelineEnd: Story = {
  name: "14.11 Refresh at timeline end",
  render: () => <WorkbenchFrame workbench={panelCompositionWorkbenches.refreshEnd} />,
};

export const RefreshAfterBack: Story = {
  name: "14.12 Refresh after Back",
  render: () => <WorkbenchFrame workbench={panelCompositionWorkbenches.refreshAfterBack} />,
};

export const ProjectHistoryIsolation: Story = {
  name: "14.13 Project history isolation",
  render: () => <WorkbenchFrame workbench={panelCompositionWorkbenches.projectIsolation} />,
};

export const Settings: Story = {
  name: "15. Settings",
  parameters: sourceParameters(settingsSource),
  render: () => <WorkbenchFrame workbench={settingsWorkbench} />,
};

export const DocumentRenderer: Story = {
  name: "16. Document renderer",
  parameters: sourceParameters(onboardingSources.documentRenderer),
  render: () => <WorkbenchFrame workbench={documentRendererWorkbench} />,
};

export const TreeCustomization: Story = {
  name: "17. Tree customization",
  parameters: sourceParameters(treeCustomizationSource),
  render: () => <WorkbenchFrame workbench={treeCustomizationWorkbench} />,
};

export const PaletteResources: Story = {
  name: "18. Palette resources",
  parameters: sourceParameters(paletteResourcesSource),
  render: () => <WorkbenchFrame workbench={paletteResourcesWorkbench} />,
};

export const ExtensionContributions: Story = {
  name: "19. Extension contributions",
  parameters: sourceParameters(extensionContributionsSource),
  render: () => <WorkbenchFrame workbench={extensionContributionsWorkbench} />,
};

export const ControlsRenderer: Story = {
  name: "20. Controls renderer",
  parameters: sourceParameters(controlsRendererSource),
  render: () => <WorkbenchFrame workbench={controlsRendererWorkbench} />,
};

export const DataTableRenderer: Story = {
  name: "21. Data table renderer",
  parameters: sourceParameters(dataTableRendererSource),
  render: () => <WorkbenchFrame workbench={dataTableRendererWorkbench} />,
};
