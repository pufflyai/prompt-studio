import { Box } from "@chakra-ui/react";
import { Toaster } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useWorkbenchThemePreferences, Workbench, WorkbenchThemeProvider } from "../../react";
import { createDataRendererStoryModule } from "../data-renderer/module";
import { createExtensionThemesWorkbench } from "../extension-themes/module";
import type { WorkbenchStoryProps } from "../workbench-story";
import { createCommandKeybindingThemeModule } from "./command-theme-module";
import { dataRendererFavoritesSource } from "./data-renderer-favorites-source";
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
import { onboardingSources } from "./sources";
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
// provider is fed from `workbench.themes` so it wraps the frame and Toaster too.
const WorkbenchFrame = (props: WorkbenchStoryProps) => {
  const { workbench } = props;
  const themePreferences = useWorkbenchThemePreferences(workbench);

  return (
    <WorkbenchThemeProvider themePreferences={themePreferences}>
      <Box h="520px" minH="360px" borderWidth="1px" borderColor="border.muted" overflow="hidden">
        <Workbench workbench={workbench} />
      </Box>
      <Toaster />
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
const dataRendererFavoritesWorkbench = createWorkbench(createDataRendererStoryModule());
const extensionsWorkbench = createExtensionThemesWorkbench();
const widgetVariantsWorkbench = createWorkbench(createWidgetVariantsModule());

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

export const DataRendererAndFavorites: Story = {
  name: "10. Data renderer and favorites",
  parameters: sourceParameters(dataRendererFavoritesSource),
  render: () => <WorkbenchFrame workbench={dataRendererFavoritesWorkbench} />,
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
