import { Badge, Box, Button, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useThemePreference } from "@pstdio/ui";
import type { WorkbenchModuleContribution, WorkbenchWidgetRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { type ExtensionColorTheme, extensionColorThemes } from "./themes";

const THEME_PACK_WIDGET_ID = "extension.theme-pack.panel";
const THEME_PACK_RENDERER_ID = "extension.theme-pack.renderer";
const CHANGE_THEME_COMMAND_ID = "workbench.action.changeTheme";

// VS Code tokens worth previewing as swatches — they map onto the workbench
// surfaces a user notices first when a theme is applied.
const swatchTokens = ["editor.background", "sideBar.background", "button.background", "focusBorder"] as const;

const ThemeSwatches = (props: { colors: Record<string, string> }) => {
  const { colors } = props;

  return (
    <HStack gap="0" borderWidth="1px" borderColor="border.muted" borderRadius="sm" overflow="hidden" w="fit-content">
      {swatchTokens.map((token) => (
        <Box key={token} h="24px" w="32px" bg={colors[token] ?? "transparent"} title={token} />
      ))}
    </HStack>
  );
};

interface ThemeCardProps {
  theme: ExtensionColorTheme;
  active: boolean;
  onApply: () => void;
}

const ThemeCard = (props: ThemeCardProps) => {
  const { theme, active, onApply } = props;

  return (
    <Stack gap="sm" p="md" borderWidth="1px" borderColor={active ? "border.accent" : "border.muted"} borderRadius="md">
      <HStack justify="space-between">
        <Text textStyle="label/S/semibold">{theme.title}</Text>
        <Badge colorPalette={theme.mode === "dark" ? "purple" : "orange"}>{theme.mode}</Badge>
      </HStack>
      <ThemeSwatches colors={theme.theme.colors ?? {}} />
      <Button size="xs" variant={active ? "solid" : "outline"} onClick={onApply}>
        <WorkbenchIcon name={active ? "Check" : "Palette"} />
        {active ? "Active" : "Apply theme"}
      </Button>
    </Stack>
  );
};

const ThemePackPanel = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const { themePreference, setThemePreference } = useThemePreference();

  return (
    <Stack h="full" minH="0" overflow="auto" p="lg" gap="lg" bg="bg" color="fg">
      <Stack gap="xs">
        <HStack gap="sm">
          <WorkbenchIcon name="Palette" size={16} />
          <Text textStyle="heading/M/semibold">Theme Pack</Text>
        </HStack>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          This extension ships VS Code-compatible color themes. The workbench maps their tokens onto its chrome, so
          picking one restyles the activity bar, sidebars, panels, and editor surface together.
        </Text>
      </Stack>

      <HStack gap="sm" wrap="wrap">
        <Badge colorPalette="purple">{extensionColorThemes.length} contributed themes</Badge>
        <Badge colorPalette="blue">active: {themePreference}</Badge>
      </HStack>

      <Button
        alignSelf="start"
        size="sm"
        variant="ghost"
        onClick={() => input.workbench.commands.executeCommand(CHANGE_THEME_COMMAND_ID)}
      >
        <WorkbenchIcon name="Palette" />
        Open theme picker
      </Button>

      <SimpleGrid columns={{ base: 1, md: 2 }} gap="md">
        {extensionColorThemes.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            active={theme.id === themePreference}
            onApply={() => setThemePreference(theme.id)}
          />
        ))}
      </SimpleGrid>
    </Stack>
  );
};

// The primary extension: a "Theme Pack" that contributes a gallery panel into
// the editor area. Disabling it disposes both the widget and its renderer.
export const createThemePackExtension = (): WorkbenchModuleContribution => ({
  id: "extension.theme-pack",
  activate(ctx) {
    ctx.layout.registerWidget({
      id: THEME_PACK_WIDGET_ID,
      title: "Theme Pack",
      area: "main",
      rendererId: THEME_PACK_RENDERER_ID,
    });
    ctx.renderers.registerRenderer({
      id: THEME_PACK_RENDERER_ID,
      render: (input) => <ThemePackPanel input={input} />,
    });
    ctx.layout.openWidget(THEME_PACK_WIDGET_ID);
  },
});
