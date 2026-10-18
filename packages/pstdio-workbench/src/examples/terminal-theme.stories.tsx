import { Box, Button, HStack, Stack } from "@chakra-ui/react";
import { defaultThemePreferences, type ThemePreferenceOption, useThemePreference } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
  parameters: { layout: "fullscreen", controls: { disable: true } },
  tags: ["!manifest"],
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
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThemeChangesKeepSession: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("tab", { name: "Terminal 1" }));
    const viewport = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(".xterm-viewport");
      expect(element).toBeVisible();
      return element!;
    });
    const textarea = canvasElement.querySelector(".xterm-helper-textarea");
    const background = () => getComputedStyle(viewport).backgroundColor;
    await waitFor(() => expect(background()).toBe("rgb(37, 39, 43)"));
    await userEvent.click(canvas.getByRole("button", { name: "Paper" }));
    await waitFor(() => expect(background()).toBe("rgb(238, 232, 213)"));
    await userEvent.click(canvas.getByRole("button", { name: "Preview Kiln" }));
    await waitFor(() => expect(background()).toBe("rgb(37, 39, 43)"));
    await userEvent.click(canvas.getByRole("button", { name: "End preview" }));
    await waitFor(() => expect(background()).toBe("rgb(238, 232, 213)"));
    await userEvent.click(canvas.getByRole("button", { name: "Default dark" }));
    await waitFor(() => expect(background()).toBe("rgb(10, 10, 10)"));
    await expect(canvasElement.querySelector(".xterm-helper-textarea")).toBe(textarea);
    await expect(canvas.getByText("workbench host terminal (scripted)", { exact: false })).toBeVisible();
  },
};
