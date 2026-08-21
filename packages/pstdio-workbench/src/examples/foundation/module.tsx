import { Badge, Box, Button, Code, Grid, HStack, Kbd, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, useThemePreference } from "@pstdio/ui";
import {
  createWorkbenchCore,
  type RegisteredKeybinding,
  type WorkbenchCore,
  type WorkbenchModuleContribution,
  type WorkbenchPanelRenderInput,
} from "../../core";
import { useWorkbenchStore, WorkbenchIcon } from "../../react";

const foundationRendererId = "foundation.renderer";

const getKeybindingState = (input: WorkbenchPanelRenderInput, keybinding: RegisteredKeybinding) => {
  const command = input.workbench.commands.getCommand(keybinding.commandId);
  const keybindingContextMatches = input.workbench.context.matches(keybinding.when);
  const commandVisible = command
    ? input.workbench.commands.isCommandVisible(command.command.id, keybinding.args)
    : false;
  const commandEnabled = command
    ? input.workbench.commands.isCommandEnabled(command.command.id, keybinding.args)
    : false;
  const active = Boolean(command && keybindingContextMatches && commandVisible && commandEnabled);

  return { active, command, commandEnabled, commandVisible, keybindingContextMatches };
};

const getKeybindingStatus = (state: ReturnType<typeof getKeybindingState>) => {
  if (state.active) return "active";
  if (state.keybindingContextMatches) return "blocked";
  return "inactive";
};

const getKeybindingStatusColor = (state: ReturnType<typeof getKeybindingState>) => {
  if (state.active) return "green";
  if (state.keybindingContextMatches) return "yellow";
  return "gray";
};

const KeybindingRow = (props: { input: WorkbenchPanelRenderInput; keybinding: RegisteredKeybinding }) => {
  const { input, keybinding } = props;
  const state = getKeybindingState(input, keybinding);
  const status = getKeybindingStatus(state);
  const command = state.command?.command;

  return (
    <Box
      data-keybinding-command-id={keybinding.commandId}
      data-keybinding-state={status}
      borderTopWidth="1px"
      borderColor="border.subtle"
      pt="xs"
    >
      <HStack gap="xs" minW="0">
        <Badge colorPalette={getKeybindingStatusColor(state)}>{status}</Badge>
        <Text textStyle="paragraph/S/medium" color="fg" flex="1" minW="0" truncate>
          {command?.label ?? keybinding.commandId}
        </Text>
        <Kbd>{keybinding.keybinding}</Kbd>
      </HStack>
      <Stack gap="2xs" mt="2xs">
        <Text textStyle="label/XS/regular" color="fg.muted" overflowWrap="anywhere">
          binding <Code colorPalette="gray">{keybinding.when ?? "always"}</Code>
        </Text>
        <Text textStyle="label/XS/regular" color="fg.muted" overflowWrap="anywhere">
          command <Code colorPalette="gray">{command?.when ?? "always"}</Code>
        </Text>
      </Stack>
    </Box>
  );
};

const FoundationPanel = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const context = useWorkbenchStore(input.workbench.context.store, (state) => state.values);
  const activeMode = useWorkbenchStore(input.workbench.modes.store, (state) => state.activeModeId) ?? "none";
  const focusRegion = useWorkbenchStore(input.workbench.focus.store, (state) => state.activeRegion) ?? "none";
  const { themePreference, toggleThemePreference } = useThemePreference();
  useWorkbenchStore(input.workbench.keybindings.store, (state) => state.keybindings);
  useWorkbenchStore(input.workbench.commands.store, (state) => state.commands);
  const keybindings = input.workbench.keybindings.listKeybindings();

  return (
    <ScrollArea h="full" contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "md" }}>
      <HStack gap="sm" wrap="wrap">
        <Badge colorPalette="blue">mode {activeMode}</Badge>
        <Badge colorPalette="green">focus {focusRegion}</Badge>
        <Badge colorPalette="purple">theme {themePreference}</Badge>
      </HStack>
      <HStack gap="sm" wrap="wrap">
        <Button size="sm" onClick={() => input.workbench.focus.setActiveRegion("sidenav")}>
          <WorkbenchIcon name="PanelLeft" />
          Focus sidenav
        </Button>
        <Button size="sm" onClick={() => input.workbench.focus.setActiveRegion("secondary")}>
          <WorkbenchIcon name="PanelBottom" />
          Focus panel
        </Button>
        <Button
          size="sm"
          onClick={() => input.workbench.modes.setActiveMode(activeMode === "project" ? "review" : "project")}
        >
          <WorkbenchIcon name="GitCompare" />
          Switch mode
        </Button>
        <Button size="sm" onClick={toggleThemePreference}>
          <WorkbenchIcon name="Contrast" />
          Theme
        </Button>
      </HStack>
      <Grid templateColumns={{ base: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" }} gap="md">
        <Box borderWidth="1px" borderColor="border.subtle" p="md">
          <Text textStyle="label/S/semibold">Context</Text>
          <ScrollArea>
            <Text as="pre" fontFamily="mono" fontSize="xs" whiteSpace="pre-wrap">
              {JSON.stringify(context, null, 2)}
            </Text>
          </ScrollArea>
        </Box>
        <Box borderWidth="1px" borderColor="border.subtle" p="md">
          <Text textStyle="label/S/semibold">Keybindings</Text>
          <Stack gap="xs" mt="sm">
            {keybindings.map((keybinding) => (
              <KeybindingRow
                key={`${keybinding.commandId}-${keybinding.keybinding}`}
                input={input}
                keybinding={keybinding}
              />
            ))}
          </Stack>
        </Box>
      </Grid>
    </ScrollArea>
  );
};

const FoundationBadge = (props: { label: string; icon: string }) => {
  const { label, icon } = props;

  return (
    <HStack gap="xs" h="full" px="sm">
      <WorkbenchIcon name={icon} size={14} />
      <Text textStyle="label/XS/regular">{label}</Text>
    </HStack>
  );
};

const registerPanels = (workbench: WorkbenchCore) => {
  workbench.renderers.registerRenderer({
    id: foundationRendererId,
    render: (input) => {
      if (input.panel.id === "foundation.main" || input.panel.id === "foundation.panel") {
        return <FoundationPanel input={input} />;
      }
      return <FoundationBadge label={input.panel.title} icon={input.panel.config as string} />;
    },
  });

  workbench.layout.registerPanel({
    id: "foundation.activity",
    title: "Activity",
    region: "activity",
    rendererId: foundationRendererId,
    config: "Blocks",
  });
  workbench.layout.registerPanel({
    id: "foundation.sidenav",
    title: "Sidenav",
    region: "sidenav",
    rendererId: foundationRendererId,
    config: "PanelLeft",
  });
  workbench.layout.registerPanel({
    id: "foundation.main",
    title: "Foundation",
    region: "main",
    rendererId: foundationRendererId,
  });
  workbench.layout.registerPanel({
    id: "foundation.panel",
    title: "Panel",
    region: "secondary",
    rendererId: foundationRendererId,
  });
  workbench.layout.registerPanel({
    id: "foundation.status",
    title: "Ready",
    region: "status",
    rendererId: foundationRendererId,
    config: "CircleCheck",
  });
};

export const createFoundationWorkbench = () => {
  const savedLayouts: ReturnType<WorkbenchCore["layout"]["getLayout"]>[] = [];
  const workbench = createWorkbenchCore({
    layoutPersistence: {
      getLayout: () => savedLayouts.at(-1),
      setLayout: (layout) => savedLayouts.push(structuredClone(layout)),
    },
  });

  registerPanels(workbench);
  workbench.context.set("foundation.host", true);
  workbench.layout.setRegionSize("sidenav", 280);
  workbench.layout.setRegionSize("secondary", 260);
  workbench.layout.openPanel("foundation.activity", { pinned: true });
  workbench.layout.openPanel("foundation.sidenav", { pinned: true });
  workbench.layout.openPanel("foundation.status", { pinned: true });
  workbench.layout.openPanel("foundation.main", {});
  workbench.layout.openPanel("foundation.panel", {});
  workbench.commands.registerCommand(
    {
      id: "foundation.markReviewed",
      label: "Mark reviewed",
      category: "Foundation",
      when: "mainFocus || secondaryFocus",
    },
    { execute: () => workbench.notifications.show({ level: "success", title: "Reviewed" }) },
  );
  workbench.keybindings.registerKeybinding({
    commandId: "foundation.markReviewed",
    keybinding: "mod+shift+e",
    when: "activeWorkbenchMode == review && !inputFocus",
  });
  workbench.layout.registerMenuItem(["commandPalette"], { commandId: "foundation.markReviewed", group: "Foundation" });
  workbench.registerModule(createFoundationModesModule());
  workbench.modes.setActiveMode("project");

  return workbench;
};

const createFoundationModesModule = (): WorkbenchModuleContribution => ({
  id: "foundation.modes",
  activate(ctx) {
    ctx.modes.registerMode({
      id: "project",
      activate(modeCtx) {
        modeCtx.context.set("foundation.project", true);
        modeCtx.layout.openPanel("foundation.main", { title: "Project Foundation" });
      },
    });
    ctx.modes.registerMode({
      id: "review",
      activate(modeCtx) {
        modeCtx.context.set("foundation.review", true);
        modeCtx.layout.openPanel("foundation.panel", { title: "Review Panel" });
      },
    });
  },
});
