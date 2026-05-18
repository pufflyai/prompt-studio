import { Badge, Box, Button, Code, HStack, Kbd, Stack, Text } from "@chakra-ui/react";
import {
  type WorkbenchModuleContribution,
  type WorkbenchTheme,
  type WorkbenchWidgetRenderInput,
  workbenchCommandPaletteMenuPath,
} from "../../core";
import { useWorkbenchStore, WorkbenchIcon } from "../../react";

const COMMANDS_WIDGET_ID = "onboarding.commands";
const COMMANDS_RENDERER_ID = "onboarding.commands.renderer";
const CYCLE_THEME_COMMAND_ID = "onboarding.cycle-theme";
const RESET_THEME_COMMAND_ID = "onboarding.reset-theme";
const CHANGE_THEME_COMMAND_ID = "workbench.action.changeTheme";
const ONBOARDING_THEME_ID = "onboarding-focus";

const onboardingTheme = {
  id: ONBOARDING_THEME_ID,
  tokens: {
    activityBarBackground: "#0f172a",
    sideBarBackground: "#f1f5f9",
    mainBackground: "#f8fafc",
    panelBackground: "#ffffff",
    statusBarBackground: "#134e4a",
    focusBorder: "#f59e0b",
    commandPaletteBackground: "#ffffff",
  },
} satisfies WorkbenchTheme;

const commandIds = [CYCLE_THEME_COMMAND_ID, RESET_THEME_COMMAND_ID, CHANGE_THEME_COMMAND_ID];

const CommandThemePanel = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const activeTheme = useWorkbenchStore(input.workbench.theme.store, (state) => state.theme);
  useWorkbenchStore(input.workbench.keybindings.store, (state) => state.keybindings);
  useWorkbenchStore(input.workbench.commands.store, (state) => state.commands);
  const commands = commandIds
    .map((id) => input.workbench.commands.getCommand(id)?.command)
    .filter((command) => command !== undefined);
  const keybindings = input.workbench.keybindings
    .listKeybindings()
    .filter((keybinding) => commandIds.includes(keybinding.commandId));
  const themes = input.workbench.theme.listThemes();

  return (
    <Stack h="full" minH="0" overflow="auto" p="lg" gap="lg" bg="var(--workbench-main-bg)" color="#0f172a">
      <HStack gap="sm" wrap="wrap">
        <Badge colorPalette="purple">theme {activeTheme.id}</Badge>
        <Badge colorPalette="blue">{commands.length} commands</Badge>
        <Badge colorPalette="green">{keybindings.length} keybindings</Badge>
      </HStack>
      <HStack gap="sm" wrap="wrap">
        <Button size="sm" onClick={() => input.workbench.commands.executeCommand(CYCLE_THEME_COMMAND_ID)}>
          <WorkbenchIcon name="RefreshCw" />
          Cycle theme
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => input.workbench.commands.executeCommand(RESET_THEME_COMMAND_ID)}
        >
          <WorkbenchIcon name="RotateCcw" />
          Reset theme
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => input.workbench.commands.executeCommand(CHANGE_THEME_COMMAND_ID)}
        >
          <WorkbenchIcon name="Palette" />
          Theme picker
        </Button>
      </HStack>
      <HStack align="start" gap="lg" wrap="wrap">
        <Stack minW="220px" gap="sm">
          <Text textStyle="label/S/semibold">Commands</Text>
          {commands.map((command) => (
            <Box key={command.id} borderTopWidth="1px" borderColor="border.muted" pt="xs">
              <Text textStyle="paragraph/S/medium">{command.label}</Text>
              <Code colorPalette="gray">{command.id}</Code>
            </Box>
          ))}
        </Stack>
        <Stack minW="220px" gap="sm">
          <Text textStyle="label/S/semibold">Keybindings</Text>
          {keybindings.map((keybinding) => (
            <HStack key={`${keybinding.commandId}-${keybinding.keybinding}`} justify="space-between">
              <Text textStyle="paragraph/S/regular" minW="0" truncate>
                {keybinding.commandId}
              </Text>
              <Kbd>{keybinding.keybinding}</Kbd>
            </HStack>
          ))}
        </Stack>
        <Stack minW="220px" gap="sm">
          <Text textStyle="label/S/semibold">Themes</Text>
          {themes.map((theme) => (
            <Button
              key={theme.id}
              size="sm"
              variant={theme.id === activeTheme.id ? "solid" : "outline"}
              onClick={() => input.workbench.theme.setTheme(theme.id)}
            >
              <WorkbenchIcon name="Circle" />
              {theme.id}
            </Button>
          ))}
        </Stack>
      </HStack>
    </Stack>
  );
};

export const createCommandKeybindingThemeModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.commands-keybindings-themes",
  activate(ctx) {
    ctx.theme.registerTheme(onboardingTheme);
    ctx.layout.registerWidget({
      id: COMMANDS_WIDGET_ID,
      title: "Commands",
      area: "main",
      rendererId: COMMANDS_RENDERER_ID,
    });
    ctx.renderers.registerRenderer({
      id: COMMANDS_RENDERER_ID,
      render: (input) => <CommandThemePanel input={input} />,
    });
    ctx.commands.registerCommand(
      { id: CYCLE_THEME_COMMAND_ID, label: "Cycle theme", category: "Onboarding", icon: "RefreshCw" },
      {
        execute: () => {
          const ids = ctx.theme.listThemes().map((theme) => theme.id);
          const currentIndex = Math.max(0, ids.indexOf(ctx.theme.getTheme().id));
          ctx.theme.setTheme(ids[(currentIndex + 1) % ids.length] ?? "light");
        },
      },
    );
    ctx.commands.registerCommand(
      { id: RESET_THEME_COMMAND_ID, label: "Reset theme", category: "Onboarding", icon: "RotateCcw" },
      { execute: () => ctx.theme.setTheme("light") },
    );
    ctx.keybindings.registerKeybinding({
      commandId: CYCLE_THEME_COMMAND_ID,
      keybinding: "ctrl+shift+y",
      when: "!inputFocus",
    });
    ctx.keybindings.registerKeybinding({
      commandId: RESET_THEME_COMMAND_ID,
      keybinding: "ctrl+shift+x",
      when: "!inputFocus",
    });
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: CYCLE_THEME_COMMAND_ID, order: 10 });
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: RESET_THEME_COMMAND_ID, order: 20 });
    ctx.layout.openWidget(COMMANDS_WIDGET_ID);
  },
});
