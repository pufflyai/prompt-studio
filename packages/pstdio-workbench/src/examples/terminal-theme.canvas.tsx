import { Box, Button, HStack, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { defaultThemePreferences, type ThemePreferenceOption, useThemePreference } from "@pstdio/ui";
import { Workbench, WorkbenchThemeProvider } from "../react";
import { createHostTerminalWorkbench } from "./host-terminal-story";

const workbench = createHostTerminalWorkbench();
const themes: ThemePreferenceOption[] = [
  {
    id: "terminal-story.kiln",
    mode: "dark",
    tokens: { "colors.bg": "#25272b", "colors.fg": "#e7e9ec" },
  },
  {
    id: "terminal-story.dark-paper",
    mode: "light",
    tokens: {
      "colors.bg": "#fdf6e3",
      "colors.fg": "#657b83",
      "colors.vscode.terminal.background": "#eee8d5",
      "colors.vscode.terminal.foreground": "#586e75",
      "colors.vscode.terminal.ansiRed": "#dc322f",
    },
  },
];
const ThemeControls = () => {
  const { setThemePreference, previewThemePreference } = useThemePreference();
  return (
    <HStack p="xs">
      <Button size="xs" onClick={() => setThemePreference(themes[1].id)}>
        Paper
      </Button>
      <Button size="xs" onClick={() => previewThemePreference(themes[0].id)}>
        Preview Kiln
      </Button>
      <Button size="xs" onClick={() => previewThemePreference(null)}>
        End preview
      </Button>
      <Button size="xs" onClick={() => setThemePreference("pstdio-dark")}>
        Default dark
      </Button>
    </HStack>
  );
};
const meta = {
  title: "pstdio-workbench/Reference/Host terminal themes",
  fullscreen: true,
  render: () => (
    <WorkbenchThemeProvider
      initialThemePreference={themes[0].id}
      themePreferences={[...defaultThemePreferences, ...themes]}
    >
      <Stack h="100dvh" minH="0" gap="0">
        <ThemeControls />
        <Box flex="1" minH="0">
          <Workbench workbench={workbench} />
        </Box>
      </Stack>
    </WorkbenchThemeProvider>
  ),
} satisfies CanvasMeta;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const ThemeChangesKeepSession: Story = {
  id: "pstdio-workbench-reference-host-terminal-themes--theme-changes-keep-session",
};
