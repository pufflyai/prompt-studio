import { HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, Switch } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { createWorkbenchCore, type WorkbenchModuleContribution } from "../../core";
import { WorkbenchIcon } from "../../react";
import { createExtensionHost, type ExtensionDefinition, type ExtensionHost } from "./extension-host";
import { createThemePackExtension } from "./theme-pack-extension";
import { createThemeStatusExtension } from "./theme-status-extension";
import { extensionThemePreferences } from "./themes";

const MANAGER_WIDGET_ID = "extension.manager.panel";
const MANAGER_RENDERER_ID = "extension.manager.renderer";
const EMPTY_MAIN_ID = "extension.manager.empty-main";
const EMPTY_MAIN_RENDERER_ID = "extension.manager.empty-main.renderer";

const extensionDefinitions: ExtensionDefinition[] = [
  {
    id: "theme-pack",
    name: "Theme Pack",
    description: "Bundles VS Code-compatible color themes that restyle the workbench chrome.",
    contributes: "Color themes and a gallery in the editor region",
    icon: "Palette",
    themes: extensionThemePreferences,
    createModule: createThemePackExtension,
  },
  {
    id: "theme-status",
    name: "Theme Status",
    description: "Shows the name of the active theme in the status bar.",
    contributes: "Status bar item",
    icon: "Activity",
    createModule: createThemeStatusExtension,
  },
];

const useEnabledExtensionIds = (host: ExtensionHost) => {
  const [enabledIds, setEnabledIds] = useState(host.getEnabledIds());

  useEffect(() => {
    const subscription = host.subscribe(() => setEnabledIds(host.getEnabledIds()));
    return () => subscription.dispose();
  }, [host]);

  return enabledIds;
};

interface ExtensionRowProps {
  definition: ExtensionDefinition;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const ExtensionRow = (props: ExtensionRowProps) => {
  const { definition, enabled, onToggle } = props;

  return (
    <Stack gap="2xs" p="sm" borderWidth="1px" borderColor="border.subtle" borderRadius="md">
      <HStack justify="space-between" align="start" gap="sm">
        <HStack gap="xs" minW="0">
          <WorkbenchIcon name={definition.icon} size={14} color={enabled ? "fg" : "fg.muted"} />
          <Text textStyle="label/S/medium" color={enabled ? "fg" : "fg.muted"}>
            {definition.name}
          </Text>
        </HStack>
        <Switch
          checked={enabled}
          size="sm"
          aria-label={`${enabled ? "Disable" : "Enable"} ${definition.name}`}
          onCheckedChange={(details) => onToggle(details.checked)}
        />
      </HStack>
      <Text textStyle="paragraph/XS/regular" color="fg.muted">
        {definition.description}
      </Text>
      <HStack gap="2xs">
        <WorkbenchIcon name="CornerDownRight" size={11} color="fg.subtle" />
        <Text textStyle="label/XS/regular" color="fg.subtle">
          {definition.contributes}
        </Text>
      </HStack>
    </Stack>
  );
};

const ExtensionManagerPanel = (props: { host: ExtensionHost }) => {
  const { host } = props;
  const enabledIds = useEnabledExtensionIds(host);

  return (
    <ScrollArea
      h="full"
      minH="0"
      bg="bg"
      color="fg"
      contentProps={{ p: "md", display: "flex", flexDirection: "column", gap: "md" }}
    >
      <Stack gap="2xs">
        <Text textStyle="label/S/semibold">Extensions</Text>
        <Text textStyle="paragraph/XS/regular" color="fg.muted">
          Toggle an extension to register or dispose its workbench contributions.
        </Text>
      </Stack>
      {host.definitions.map((definition) => (
        <ExtensionRow
          key={definition.id}
          definition={definition}
          enabled={enabledIds.includes(definition.id)}
          onToggle={(enabled) => host.setEnabled(definition.id, enabled)}
        />
      ))}
    </ScrollArea>
  );
};

const EmptyMainPanel = () => (
  <Stack h="full" minH="0" align="center" justify="center" gap="xs" bg="bg" color="fg" p="lg">
    <WorkbenchIcon name="Puzzle" size={20} color="fg.muted" />
    <Text textStyle="label/S/medium" color="fg.muted">
      No extension views
    </Text>
    <Text textStyle="paragraph/XS/regular" color="fg.subtle" textAlign="center">
      Enable an extension from the Extensions sidebar to see what it contributes.
    </Text>
  </Stack>
);

// The extension manager is always present — it owns the enable/disable UI, so it
// must not be one of the extensions it can dispose.
const createExtensionManagerModule = (host: ExtensionHost): WorkbenchModuleContribution => ({
  id: "extension.manager",
  activate(ctx) {
    ctx.layout.registerWidget({
      id: MANAGER_WIDGET_ID,
      title: "Extensions",
      region: "sidebar",
      regionSize: { defaultPx: 280, minPx: 240 },
      rendererId: MANAGER_RENDERER_ID,
    });
    ctx.renderers.registerRenderer({
      id: MANAGER_RENDERER_ID,
      render: () => <ExtensionManagerPanel host={host} />,
    });
    ctx.layout.registerPlaceholder({
      id: EMPTY_MAIN_ID,
      title: "No extension views",
      region: "main",
      rendererId: EMPTY_MAIN_RENDERER_ID,
    });
    ctx.renderers.registerRenderer({
      id: EMPTY_MAIN_RENDERER_ID,
      render: () => <EmptyMainPanel />,
    });
    ctx.layout.openWidget(MANAGER_WIDGET_ID);
  },
});

export const createExtensionThemesWorkbench = () => {
  const workbench = createWorkbenchCore();
  const host = createExtensionHost(workbench, extensionDefinitions);
  workbench.registerModule(createExtensionManagerModule(host));
  for (const definition of extensionDefinitions) {
    host.setEnabled(definition.id, true);
  }
  return workbench;
};
