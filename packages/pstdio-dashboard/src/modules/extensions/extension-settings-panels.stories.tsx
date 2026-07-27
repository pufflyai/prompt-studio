import { Box } from "@chakra-ui/react";
import { createWorkbenchCore } from "@pstdio/workbench";
import { createWorkbenchSettingsModule, settingsPanelResource, Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { registerExtensionSettingsPanels } from "./extension-settings-panels";

const PROJECT_ID = "demo-project";

// Stub webview wiring — the story only exercises the sidenav icon path, the panel
// body itself is not rendered.
const stubWebview = (id: string) => ({
  entry: {
    kind: "package-asset" as const,
    path: `./src/views/${id}.tsx`,
    baseUrl: "file:///extensions/demo/extension.ts",
  },
  runtimeUrl: `/runtime/${id}.html`,
  moduleUrl: `/modules/${id}.js`,
});

const mockMetadata: DashboardExtensionMetadata = {
  ...emptyDashboardExtensionMetadata,
  settingsPanels: [
    {
      id: "demo.ticketStatuses",
      extensionId: "pstdio.demo",
      slotId: "project.settingsPanels",
      target: "workbench.settings",
      scope: "project",
      title: "Ticket statuses",
      icon: "list-checks",
      webview: stubWebview("statuses"),
    },
    {
      id: "demo.ticketTags",
      extensionId: "pstdio.demo",
      slotId: "project.settingsPanels",
      target: "workbench.settings",
      scope: "project",
      title: "Ticket tags",
      icon: "tag",
      webview: stubWebview("tags"),
    },
    {
      id: "demo.workspaceAutomations",
      extensionId: "pstdio.demo",
      slotId: "project.settingsPanels",
      target: "workbench.settings",
      scope: "project",
      title: "Workspace automations",
      webview: stubWebview("automations"),
    },
  ],
};

const workbench = createWorkbenchCore();
workbench.registerModule({
  id: "story.extension-settings-icons",
  activate(ctx) {
    ctx.settings.registerSection({ id: "project", title: "Project", order: 10 });
    ctx.settings.registerSection({ id: "workbench", title: "Workbench", order: 20 });

    const surface = createWorkbenchSettingsModule({
      resolveScopeId: (scope) => (scope === "project" ? PROJECT_ID : undefined),
    }).activate(ctx);

    const disposables = registerExtensionSettingsPanels(ctx, {
      metadata: mockMetadata,
      projectId: PROJECT_ID,
    });

    // Pop the settings overlay so the icon-bearing sidenav is the focus of the story.
    void ctx.resources.openResource(
      settingsPanelResource({ id: "demo.ticketStatuses", title: "Ticket statuses", icon: "list-checks" }),
    );

    return [...(Array.isArray(surface) ? surface : surface ? [surface] : []), ...disposables];
  },
});

const meta = {
  title: "Extensions/SettingsPanelIcons",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj;

// Sidenav shows panels with declared icons (`list-checks`, `tag`) alongside one
// that omits `icon` and falls back to `Sliders`.
export const Default: Story = {
  render: () => (
    <Box h="100dvh" w="full">
      <Workbench workbench={workbench} />
    </Box>
  ),
};
