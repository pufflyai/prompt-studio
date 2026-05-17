import { Box, HStack, Text } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "../../../react";
import { WorkbenchIcon } from "../../../react";
import { dashboardTickets } from "../mock-data/data";
import { WebviewPlaceholder } from "./webview-placeholder";

export const ExtensionRouteWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const routeId = input.placement.resource?.id ?? "repo-health";
  const title = input.placement.resource?.label ?? "Repo health";
  const entry = routeId === "changelog" ? "changelog.tsx" : routeId === "lab" ? "lab.tsx" : "health-page.tsx";

  return (
    <Box h="full" minH="0" p="md">
      <WebviewPlaceholder
        slotId="routes[].webview"
        title={`/projects/acme/extensions/${routeId}`}
        contributor={title === "Lab" ? "extension-lab" : "repo-health"}
        entry={entry}
        icon={input.placement.resource?.icon ?? "PanelLeft"}
        height="100%"
      />
    </Box>
  );
};

export const SettingsWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const title = input.placement.resource?.label ?? "Project settings";
  const isExtensionSettings = input.placement.resource?.id?.startsWith("settings/lab") === true;

  return (
    <Box h="full" minH="0" p="md">
      <WebviewPlaceholder
        slotId="project.settingsPanels.webview"
        title={title}
        contributor={isExtensionSettings ? "extension-lab" : "pstdio"}
        entry={isExtensionSettings ? "lab-settings.tsx" : "project-settings.tsx"}
        icon={input.placement.resource?.icon ?? "Settings"}
        height="100%"
      />
    </Box>
  );
};

export const StatusWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  return (
    <HStack h="full" gap="md" px="sm" minW="0">
      <HStack gap="xs">
        <WorkbenchIcon name="KanbanSquare" size={13} />
        <Text textStyle="label/XS/regular">{dashboardTickets.length} tickets</Text>
      </HStack>
      <HStack gap="xs">
        <WorkbenchIcon name="Puzzle" size={13} />
        <Text textStyle="label/XS/regular">{input.workbench.commands.listCommands().length} commands</Text>
      </HStack>
      <Box flex="1" />
      <Text textStyle="label/XS/regular" color="fg.muted" truncate>
        dashboard-workbench story
      </Text>
    </HStack>
  );
};
