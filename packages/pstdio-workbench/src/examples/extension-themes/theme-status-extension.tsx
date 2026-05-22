import { HStack, Text } from "@chakra-ui/react";
import { useThemePreference } from "@pstdio/ui";
import type { WorkbenchModuleContribution } from "../../core";
import { WorkbenchIcon } from "../../react";

const STATUS_WIDGET_ID = "extension.theme-status.item";
const STATUS_RENDERER_ID = "extension.theme-status.renderer";

const ThemeStatusItem = () => {
  const { themePreference, themePreferences } = useThemePreference();
  const active = themePreferences.find((theme) => theme.id === themePreference);

  return (
    <HStack h="full" align="center" gap="xs" px="sm">
      <WorkbenchIcon name="Palette" size={12} color="fg.muted" />
      <Text textStyle="label/XS/medium" color="fg.muted" whiteSpace="nowrap">
        {active?.title ?? themePreference}
      </Text>
    </HStack>
  );
};

// A second, deliberately small extension: it only contributes a status-bar
// item, so disabling it empties the status bar without touching anything else.
export const createThemeStatusExtension = (): WorkbenchModuleContribution => ({
  id: "extension.theme-status",
  activate(ctx) {
    ctx.layout.registerWidget({
      id: STATUS_WIDGET_ID,
      title: "Theme status",
      area: "status",
      singleton: true,
      rendererId: STATUS_RENDERER_ID,
    });
    ctx.renderers.registerRenderer({
      id: STATUS_RENDERER_ID,
      render: () => <ThemeStatusItem />,
    });
    ctx.layout.openWidget(STATUS_WIDGET_ID);
  },
});
