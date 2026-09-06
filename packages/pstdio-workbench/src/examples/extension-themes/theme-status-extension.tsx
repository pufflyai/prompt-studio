import { HStack, Text } from "@chakra-ui/react";
import { useThemePreference } from "@pstdio/ui";
import type { WorkbenchModuleContribution } from "../../core";
import { WorkbenchIcon } from "../../react";

const STATUS_WIDGET_ID = "extension.theme-status.item";

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
    ctx.views.registerView({
      id: STATUS_WIDGET_ID,
      title: "Theme status",
      body: { kind: "react", render: () => <ThemeStatusItem /> },
    });
    ctx.statusBar.registerItem({ id: STATUS_WIDGET_ID, viewId: STATUS_WIDGET_ID, slot: "trailing" });
  },
});
