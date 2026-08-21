import { Badge, Box, Button, Code, HStack, Kbd, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, useThemePreference } from "@pstdio/ui";
import type { WorkbenchModuleContribution, WorkbenchPanelRenderInput } from "../../core";
import { useWorkbenchStore, WorkbenchIcon } from "../../react";

const COMMANDS_WIDGET_ID = "onboarding.commands";
const COMMANDS_RENDERER_ID = "onboarding.commands.renderer";
const CHANGE_THEME_COMMAND_ID = "workbench.action.changeTheme";

const commandIds = [CHANGE_THEME_COMMAND_ID];

const CommandThemePanel = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const { themePreference, themePreferences, setThemePreference } = useThemePreference();
  useWorkbenchStore(input.workbench.keybindings.store, (state) => state.keybindings);
  useWorkbenchStore(input.workbench.commands.store, (state) => state.commands);
  const commands = commandIds
    .map((id) => input.workbench.commands.getCommand(id)?.command)
    .filter((command) => command !== undefined);
  const keybindings = input.workbench.keybindings
    .listKeybindings()
    .filter((keybinding) => commandIds.includes(keybinding.commandId));

  return (
    <ScrollArea
      h="full"
      minH="0"
      bg="bg"
      color="fg"
      contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "lg" }}
    >
      <HStack gap="sm" wrap="wrap">
        <Badge colorPalette="purple">theme {themePreference}</Badge>
        <Badge colorPalette="blue">{commands.length} commands</Badge>
        <Badge colorPalette="green">{keybindings.length} keybindings</Badge>
      </HStack>
      <HStack gap="sm" wrap="wrap">
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
            <Box key={command.id} borderTopWidth="1px" borderColor="border.subtle" pt="xs">
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
          {themePreferences.map((theme) => (
            <Button
              key={theme.id}
              size="sm"
              variant={theme.id === themePreference ? "primary" : "outline"}
              onClick={() => setThemePreference(theme.id)}
            >
              <WorkbenchIcon name="Circle" />
              {theme.title ?? theme.id}
            </Button>
          ))}
        </Stack>
      </HStack>
    </ScrollArea>
  );
};

export const createCommandKeybindingThemeModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.commands-keybindings-themes",
  activate(ctx) {
    ctx.layout.registerPanel({
      id: COMMANDS_WIDGET_ID,
      title: "Commands",
      region: "main",
      rendererId: COMMANDS_RENDERER_ID,
    });
    ctx.renderers.registerRenderer({
      id: COMMANDS_RENDERER_ID,
      render: (input) => <CommandThemePanel input={input} />,
    });
    ctx.layout.openPanel(COMMANDS_WIDGET_ID);
  },
});
