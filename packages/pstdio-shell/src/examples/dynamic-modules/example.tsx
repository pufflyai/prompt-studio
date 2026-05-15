import { Badge, Box, Button, Code, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, Switch } from "@pstdio/ui";
import { useEffect, useState } from "react";
import {
  createShellCore,
  type Disposable,
  type ResourceRef,
  type ShellCore,
  type ShellModuleContribution,
  type ShellWidgetRenderInput,
  workbenchCommandPaletteMenuPath,
} from "../../core";
import { ShellIcon, ShellWorkbench } from "../../react";

const hostModuleId = "dynamic-modules.host";
const topControlsWidgetId = "dynamic-modules.controls";
const inventoryWidgetId = "dynamic-modules.inventory";
const openInventoryCommandId = "dynamic-modules.openInventory";

const explorerModuleId = "dynamic-modules.explorer";
const explorerWidgetId = "dynamic-modules.explorer.preview";
const explorerTreeId = "dynamic-modules.explorer.tree";
const explorerCommandId = "dynamic-modules.explorer.openReadme";
const fileKind = "dynamic-module-file";

const diagnosticsModuleId = "dynamic-modules.diagnostics";
const diagnosticsWidgetId = "dynamic-modules.diagnostics.panel";
const diagnosticsCommandId = "dynamic-modules.diagnostics.run";
const diagnosticKind = "dynamic-module-diagnostic";

const assistantModuleId = "dynamic-modules.assistant";
const assistantWidgetId = "dynamic-modules.assistant.panel";
const assistantCommandId = "dynamic-modules.assistant.open";

const readmeResource: ResourceRef = {
  kind: fileKind,
  id: "readme.md",
  uri: "pstdio://dynamic-modules/files/readme.md",
  label: "README.md",
  icon: "FileText",
};

const diagnosticResource: ResourceRef = {
  kind: diagnosticKind,
  id: "validate",
  uri: "pstdio://dynamic-modules/diagnostics/validate",
  label: "Validate",
  icon: "ListChecks",
};

interface DynamicModuleDefinition {
  id: string;
  label: string;
  icon: string;
  createModule: () => ShellModuleContribution;
}

interface DynamicModuleController {
  getEnabledModuleIds(): string[];
  setEnabled(moduleId: string, enabled: boolean): void;
  subscribe(listener: () => void): Disposable;
}

const Panel = (props: { title: string; children: React.ReactNode; action?: React.ReactNode }) => {
  const { action, children, title } = props;

  return (
    <Box borderWidth="1px" borderColor="border.muted" borderRadius="sm" bg="bg.panel" minW="0" overflow="hidden">
      <HStack borderBottomWidth="1px" borderColor="border.muted" gap="xs" minH="2.25rem" px="sm">
        <Text textStyle="label/S/medium" color="fg" flex="1" minW="0" truncate>
          {title}
        </Text>
        {action}
      </HStack>
      <Box p="sm">{children}</Box>
    </Box>
  );
};

const Metric = (props: { label: string; value: number }) => {
  const { label, value } = props;

  return (
    <Box borderWidth="1px" borderColor="border.muted" borderRadius="sm" p="sm" minW="0">
      <Text textStyle="heading/M" color="fg">
        {value}
      </Text>
      <Text textStyle="label/XS/regular" color="fg.muted" truncate>
        {label}
      </Text>
    </Box>
  );
};

const InventoryRow = (props: { icon: string; label: string; value: string }) => {
  const { icon, label, value } = props;

  return (
    <HStack gap="xs" minW="0" py="2xs">
      <ShellIcon name={icon} size={14} color="fg.muted" />
      <Text textStyle="paragraph/S/regular" color="fg" flex="1" minW="0" truncate>
        {label}
      </Text>
      <Code colorPalette="gray" truncate>
        {value}
      </Code>
    </HStack>
  );
};

const useEnabledModuleIds = (controller: DynamicModuleController) => {
  const [enabledModuleIds, setEnabledModuleIds] = useState(controller.getEnabledModuleIds());

  useEffect(() => {
    const subscription = controller.subscribe(() => setEnabledModuleIds(controller.getEnabledModuleIds()));
    return () => subscription.dispose();
  }, [controller]);

  return enabledModuleIds;
};

const DynamicModuleControls = (props: { controller: DynamicModuleController }) => {
  const { controller } = props;
  const enabledModuleIds = useEnabledModuleIds(controller);

  return (
    <HStack h="full" minW="0" overflowX="auto" overflowY="hidden" px="xs" gap="sm">
      <HStack gap="xs" flexShrink={0}>
        <ShellIcon name="Puzzle" size={14} color="fg.muted" />
        <Text textStyle="label/S/medium" color="fg" whiteSpace="nowrap">
          Runtime modules
        </Text>
      </HStack>
      {dynamicModuleDefinitions.map((definition) => {
        const enabled = enabledModuleIds.includes(definition.id);
        return (
          <HStack
            key={definition.id}
            gap="2xs"
            flexShrink={0}
            borderLeftWidth="1px"
            borderColor="border.muted"
            pl="sm"
          >
            <ShellIcon name={definition.icon} size={14} color={enabled ? "fg" : "fg.muted"} />
            <Text textStyle="label/S/regular" color={enabled ? "fg" : "fg.muted"} whiteSpace="nowrap">
              {definition.label}
            </Text>
            <Switch
              checked={enabled}
              size="sm"
              aria-label={`${enabled ? "Disable" : "Enable"} ${definition.label}`}
              onCheckedChange={(details) => controller.setEnabled(definition.id, details.checked)}
            />
          </HStack>
        );
      })}
    </HStack>
  );
};

const ModuleInventoryWidget = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const { shell } = input;
  const metrics = [
    { label: "Commands", value: shell.commands.listCommands().length },
    { label: "Widgets", value: shell.layout.listWidgets().length },
    { label: "Resources", value: shell.resources.listKinds().length },
    { label: "Tree views", value: shell.trees.listTreeViews().length },
  ];
  const contributionRows = [
    ...shell.layout.listWidgets().map((widget) => ({
      id: widget.id,
      icon: "PanelTop",
      label: widget.id,
      value: widget.ownerId,
    })),
    ...shell.commands.listCommands().map((command) => ({
      id: command.command.id,
      icon: command.command.icon ?? "Command",
      label: command.command.id,
      value: command.ownerId,
    })),
    ...shell.resources.listKinds().map((kind) => ({
      id: kind.kind,
      icon: kind.icon ?? "Database",
      label: kind.kind,
      value: kind.ownerId,
    })),
    ...shell.trees.listTreeViews().map((tree) => ({
      id: tree.id,
      icon: tree.icon ?? "ListTree",
      label: tree.id,
      value: tree.ownerId,
    })),
  ];

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Stack gap="md" w="full">
        <Grid templateColumns="repeat(auto-fit, minmax(8rem, 1fr))" gap="sm">
          {metrics.map((metric) => (
            <Metric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </Grid>
        <Panel title="Registered contributions">
          <Grid templateColumns={{ base: "1fr", xl: "repeat(2, minmax(0, 1fr))" }} gapX="lg" gapY="2xs">
            {contributionRows.map((row) => (
              <InventoryRow key={`${row.value}:${row.id}`} icon={row.icon} label={row.label} value={row.value} />
            ))}
          </Grid>
        </Panel>
      </Stack>
    </ScrollArea>
  );
};

const FilePreviewWidget = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
    <Stack gap="md" maxW="3xl">
      <Panel title="README.md">
        <Stack gap="sm">
          <InventoryRow icon="FileText" label="Resource URI" value={readmeResource.uri} />
          <Text textStyle="paragraph/S/regular" color="fg">
            Module activation registered this file kind, opener, tree view, command, and preview widget as one owned
            contribution set.
          </Text>
        </Stack>
      </Panel>
    </Stack>
  </ScrollArea>
);

const DiagnosticsWidget = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Grid templateColumns={{ base: "1fr", md: "repeat(3, minmax(0, 1fr))" }} gap="sm">
        {["Typecheck", "Lint", "Tests"].map((check) => (
          <Box key={check} borderWidth="1px" borderColor="border.muted" borderRadius="sm" p="sm" minW="0">
            <HStack gap="xs" minW="0">
              <ShellIcon name="CircleCheck" size={14} color="fg.success" />
              <Text textStyle="label/S/medium" color="fg" flex="1" minW="0" truncate>
                {check}
              </Text>
              <Badge size="sm" colorPalette="green">
                Ready
              </Badge>
            </HStack>
          </Box>
        ))}
      </Grid>
      <Button
        mt="sm"
        size="xs"
        variant="subtle"
        onClick={() => void input.shell.commands.executeCommand(diagnosticsCommandId)}
      >
        <ShellIcon name="Play" />
        Run
      </Button>
    </ScrollArea>
  );
};

const AssistantWidget = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
    <Stack gap="sm">
      <Panel title="Assistant">
        <Stack gap="xs">
          <InventoryRow icon="Bot" label="Runtime" value="attached" />
          <InventoryRow icon="MessageSquare" label="Channel" value="extension" />
        </Stack>
      </Panel>
    </Stack>
  </ScrollArea>
);

const createExplorerModule = (): ShellModuleContribution => ({
  id: explorerModuleId,
  ownerId: explorerModuleId,
  source: "extension",
  activate(ctx) {
    ctx.resources.registerKind({ kind: fileKind, label: "File", icon: "FileText" });
    ctx.renderers.registerRenderer({ id: explorerWidgetId, render: () => <FilePreviewWidget /> });
    ctx.layout.registerWidget({
      id: explorerWidgetId,
      title: "File preview",
      area: "main-left",
      singleton: true,
      rendererId: explorerWidgetId,
      areaSize: { defaultPx: 300, minPx: 220, maxPx: 460 },
    });
    ctx.resources.registerOpener({
      id: `${explorerModuleId}.opener`,
      priority: 100,
      canOpen: (resource) => resource.kind === fileKind,
      open: (resource, input) =>
        ctx.layout.openWidget(explorerWidgetId, { resource, title: resource.label, replaceActive: input.replaceActive }),
    });
    ctx.trees.registerTreeView({
      id: explorerTreeId,
      title: "Explorer",
      area: "left",
      icon: "FolderTree",
      defaultExpandedSectionIds: ["workspace"],
      getRoots: () => [],
      getSections: () => [
        {
          id: "workspace",
          nodes: [{ id: readmeResource.uri, label: "README.md", icon: "FileText", resource: readmeResource }],
        },
      ],
      getChildren: () => [],
    });
    ctx.commands.registerCommand(
      { id: explorerCommandId, label: "Open README", category: "Dynamic modules", icon: "FileText" },
      { execute: () => ctx.resources.openResource(readmeResource) },
    );
    ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: explorerCommandId, order: 20 });
    void ctx.resources.openResource(readmeResource);
  },
});

const createDiagnosticsModule = (): ShellModuleContribution => ({
  id: diagnosticsModuleId,
  ownerId: diagnosticsModuleId,
  source: "extension",
  activate(ctx) {
    ctx.resources.registerKind({ kind: diagnosticKind, label: "Diagnostic", icon: "ListChecks" });
    ctx.renderers.registerRenderer({ id: diagnosticsWidgetId, render: (input) => <DiagnosticsWidget input={input} /> });
    ctx.layout.registerWidget({
      id: diagnosticsWidgetId,
      title: "Diagnostics",
      area: "main-bottom",
      singleton: true,
      rendererId: diagnosticsWidgetId,
      areaSize: { defaultPx: 180, minPx: 120, maxPx: 320 },
    });
    ctx.commands.registerCommand(
      { id: diagnosticsCommandId, label: "Run diagnostics", category: "Dynamic modules", icon: "ListChecks" },
      {
        execute: () => {
          ctx.notifications.show({
            level: "success",
            title: "Diagnostics completed",
            resource: diagnosticResource,
          });
          return ctx.layout.openWidget(diagnosticsWidgetId, { resource: diagnosticResource });
        },
      },
    );
    ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: diagnosticsCommandId, order: 30 });
    ctx.layout.openWidget(diagnosticsWidgetId, { resource: diagnosticResource });
  },
});

const createAssistantModule = (): ShellModuleContribution => ({
  id: assistantModuleId,
  ownerId: assistantModuleId,
  source: "extension",
  activate(ctx) {
    ctx.renderers.registerRenderer({ id: assistantWidgetId, render: () => <AssistantWidget /> });
    ctx.layout.registerWidget({
      id: assistantWidgetId,
      title: "Assistant",
      area: "floating",
      singleton: true,
      rendererId: assistantWidgetId,
    });
    ctx.commands.registerCommand(
      { id: assistantCommandId, label: "Open assistant", category: "Dynamic modules", icon: "Bot" },
      { execute: () => ctx.layout.openWidget(assistantWidgetId) },
    );
    ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: assistantCommandId, order: 40 });
    ctx.layout.openWidget(assistantWidgetId);
  },
});

const dynamicModuleDefinitions: DynamicModuleDefinition[] = [
  { id: explorerModuleId, label: "Explorer", icon: "FolderTree", createModule: createExplorerModule },
  { id: diagnosticsModuleId, label: "Diagnostics", icon: "ListChecks", createModule: createDiagnosticsModule },
  { id: assistantModuleId, label: "Assistant", icon: "Bot", createModule: createAssistantModule },
];

const createDynamicModuleController = (shell: ShellCore): DynamicModuleController => {
  const registrations = new Map<string, Disposable>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const getDefinition = (moduleId: string) => dynamicModuleDefinitions.find((definition) => definition.id === moduleId);

  return {
    getEnabledModuleIds: () => [...registrations.keys()],

    setEnabled(moduleId, enabled) {
      const registration = registrations.get(moduleId);
      if (enabled && !registration) {
        const definition = getDefinition(moduleId);
        if (!definition) return;
        registrations.set(moduleId, shell.registerModule(definition.createModule()));
        notify();
        return;
      }

      if (!enabled && registration) {
        registration.dispose();
        registrations.delete(moduleId);
        notify();
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return {
        dispose() {
          listeners.delete(listener);
        },
      };
    },
  };
};

const createDynamicModulesHostModule = (controller: DynamicModuleController): ShellModuleContribution => ({
  id: hostModuleId,
  activate(ctx) {
    ctx.sessionPanel.setMode("attached");
    ctx.layout.registerWidget({
      id: topControlsWidgetId,
      title: "Runtime modules",
      area: "top",
      singleton: true,
      rendererId: topControlsWidgetId,
    });
    ctx.layout.registerWidget({
      id: inventoryWidgetId,
      title: "Module inventory",
      area: "main",
      singleton: true,
      rendererId: inventoryWidgetId,
    });
    ctx.renderers.registerRenderer({
      id: topControlsWidgetId,
      render: () => <DynamicModuleControls controller={controller} />,
    });
    ctx.renderers.registerRenderer({
      id: inventoryWidgetId,
      render: (input) => <ModuleInventoryWidget input={input} />,
    });
    ctx.commands.registerCommand(
      { id: openInventoryCommandId, label: "Open module inventory", category: "Dynamic modules", icon: "Boxes" },
      { execute: () => ctx.layout.openWidget(inventoryWidgetId) },
    );
    ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: openInventoryCommandId, order: 10 });
    ctx.layout.openWidget(topControlsWidgetId, { pinned: true });
    ctx.layout.openWidget(inventoryWidgetId);
  },
});

export const createDynamicModulesShell = () => {
  const shell = createShellCore();
  const controller = createDynamicModuleController(shell);
  shell.registerModule(createDynamicModulesHostModule(controller));
  controller.setEnabled(explorerModuleId, true);
  controller.setEnabled(diagnosticsModuleId, true);
  return shell;
};

export const DynamicModulesExample = (props: { shell: ShellCore }) => {
  const { shell } = props;

  return <ShellWorkbench shell={shell} />;
};
