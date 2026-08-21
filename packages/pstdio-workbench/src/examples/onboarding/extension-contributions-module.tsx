import { Badge, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import type { CommandExecuteRequest, CommandExecuteResponse, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { ScrollArea } from "@pstdio/ui";
import {
  headerTrailingMenuPath,
  type MenuPath,
  type WorkbenchModuleContribution,
  type WorkbenchPanelRenderInput,
} from "../../core";
import { registerWorkbenchExtensionContributions } from "../../extensions";
import { useWorkbenchStore, WorkbenchIcon } from "../../react";

const EXTENSION_ID = "pstdio.onboarding-lab";
const PROJECT_ID = "onboarding-project";
const HOST_WIDGET_ID = "onboarding.extension-contributions.host";
const HOST_RENDERER_ID = "onboarding.extension-contributions.host.renderer";
const TREE_ID = "onboarding.lab.tree";
const TREE_VIEW_ID = "onboarding.lab.tree-view";
const FOCUS_COMMAND_ID = "onboarding.lab.focus";
const TREE_BODY_COMMAND_ID = "onboarding.lab.treeBody";
const SEARCH_COMMAND_ID = "onboarding.lab.search";
const MODE_ID = "onboarding.lab.review";
const menuPath = headerTrailingMenuPath("main") satisfies MenuPath;

const success = (commandId: string, value: unknown): CommandExecuteResponse => ({
  commandId,
  extensionId: EXTENSION_ID,
  outcome: { ok: true, status: "success", value },
});

const metadata = {
  extensions: [{ id: EXTENSION_ID, name: "onboarding-lab", displayName: "Onboarding Lab", sourcePath: "" }],
  commands: [
    { id: FOCUS_COMMAND_ID, extensionId: EXTENSION_ID, title: "Focus onboarding lab" },
    { id: TREE_BODY_COMMAND_ID, extensionId: EXTENSION_ID, title: "List lab tree" },
    { id: SEARCH_COMMAND_ID, extensionId: EXTENSION_ID, title: "Search lab resources" },
  ],
  diagnostics: [],
  menuContributions: [
    {
      id: "onboarding.lab.focus.header",
      extensionId: EXTENSION_ID,
      commandId: FOCUS_COMMAND_ID,
      slotId: "onboarding.mainHeader",
      label: "Lab action",
      icon: "FlaskConical",
    },
  ],
  commandPaletteContributions: [
    {
      id: "onboarding.lab.focus.palette",
      extensionId: EXTENSION_ID,
      commandId: FOCUS_COMMAND_ID,
      label: "Focus onboarding lab",
      group: "Extension Lab",
    },
  ],
  commandPaletteResources: [
    {
      id: "onboarding.lab.resources",
      extensionId: EXTENSION_ID,
      title: "Lab resources",
      resourceKind: "onboarding.lab.resource",
      queryCommandId: SEARCH_COMMAND_ID,
    },
  ],
  modes: [
    {
      id: "onboarding.lab.review-mode",
      extensionId: EXTENSION_ID,
      modeId: MODE_ID,
      label: "Lab review",
      panelRegions: ["main"],
      modePanels: { [TREE_VIEW_ID]: { region: "main", required: true } },
    },
  ],
  routes: [],
  settingsPanels: [],
  treeItems: [],
  kanbanRenderers: [],
  panels: [
    {
      id: TREE_VIEW_ID,
      extensionId: EXTENSION_ID,
      show: { region: "main" },
      title: "Lab tree",
      renderer: { kind: "tree", id: TREE_ID },
    },
  ],
  treeRenderers: [
    {
      id: TREE_ID,
      extensionId: EXTENSION_ID,
      title: "Lab tree",
      icon: "FlaskConical",
      bodyHandlerId: TREE_BODY_COMMAND_ID,
      defaultExpandedSectionIds: ["workflows"],
    },
  ],
} satisfies WorkbenchExtensionMetadata;

const executeExtensionCommand = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  return (commandId: string, body: CommandExecuteRequest) => {
    if (commandId === FOCUS_COMMAND_ID) {
      ctx.notifications.show({ level: "success", title: "Extension command executed" });
      return success(commandId, { source: body.slot?.kind ?? "command" });
    }

    if (commandId === TREE_BODY_COMMAND_ID) {
      return success(commandId, [
        {
          id: "workflows",
          label: "Workflows",
          nodes: [
            { id: "manifest", label: "Manifest", icon: "FileJson", description: "Metadata registered" },
            { id: "commands", label: "Commands", icon: "Terminal", description: "Commands and menu wrappers" },
            { id: "resources", label: "Resources", icon: "Search", description: "Palette provider results" },
          ],
        },
      ]);
    }

    if (commandId === SEARCH_COMMAND_ID) {
      return success(commandId, {
        items: [
          {
            id: "manifest",
            label: "Extension manifest",
            description: "Command palette resource result",
            icon: "FileJson",
            keywords: ["extension", "metadata"],
            target: { kind: "command", command: FOCUS_COMMAND_ID, params: { source: "resource-provider" } },
          },
        ],
      });
    }

    return success(commandId, undefined);
  };
};

const ExtensionContributionsPanel = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  useWorkbenchStore(input.workbench.commands.store, (state) => state.commands);
  useWorkbenchStore(input.workbench.layout.store, (state) => state.widgets);
  useWorkbenchStore(input.workbench.commandPaletteResources.store, (state) => state.providers);
  const commandCount = input.workbench.commands
    .listCommands()
    .filter((record) => record.command.id.includes("onboarding.lab")).length;
  const hasTree = Boolean(input.workbench.renderers.getTreeRenderer(TREE_ID));
  const providerCount = input.workbench.commandPaletteResources.listProviders().length;

  return (
    <ScrollArea h="full" minH="0" bg="bg" color="fg" contentProps={{ p: "lg" }}>
      <Stack gap="lg" maxW="760px">
        <HStack gap="sm" wrap="wrap">
          <Badge colorPalette="blue">{commandCount} commands</Badge>
          <Badge colorPalette={hasTree ? "green" : "gray"}>{hasTree ? "tree registered" : "no tree"}</Badge>
          <Badge colorPalette="purple">{providerCount} palette providers</Badge>
        </HStack>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          This story feeds extension metadata through the same host mapper used by product extensions. The host creates
          commands, menu wrappers, a tree-backed view, a dynamic palette provider, and a mode contribution.
        </Text>
        <HStack gap="sm" wrap="wrap">
          <Button size="sm" onClick={() => input.workbench.commands.executeCommand(FOCUS_COMMAND_ID)}>
            <WorkbenchIcon name="Play" />
            Run command
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => input.workbench.commandPalette.open({ initialQuery: "lab" })}
          >
            <WorkbenchIcon name="Search" />
            Search lab
          </Button>
          <Button size="sm" variant="outline" onClick={() => input.workbench.modes.setActiveMode(MODE_ID)}>
            <WorkbenchIcon name="PanelTop" />
            Activate mode
          </Button>
        </HStack>
        <Code colorPalette="gray">registerWorkbenchExtensionContributions(metadata)</Code>
      </Stack>
    </ScrollArea>
  );
};

export const createExtensionContributionsModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.extension-contributions",
  activate(ctx) {
    ctx.layout.registerPanel({
      id: HOST_WIDGET_ID,
      title: "Extension contributions",
      region: "main",
      rendererId: HOST_RENDERER_ID,
    });
    ctx.renderers.registerRenderer({
      id: HOST_RENDERER_ID,
      render: (input) => <ExtensionContributionsPanel input={input} />,
    });
    ctx.layout.openPanel(HOST_WIDGET_ID);

    const extensionDisposable = registerWorkbenchExtensionContributions({
      executeCommand: executeExtensionCommand(ctx),
      menuSlotsById: new Map([["onboarding.mainHeader", { menuPath, group: "primary" }]]),
      metadata,
      projectId: PROJECT_ID,
      workbench: ctx,
    });

    ctx.layout.openPanel(TREE_VIEW_ID, { pinned: true });
    return extensionDisposable;
  },
});
