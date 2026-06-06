import { Box, SimpleGrid, Text } from "@chakra-ui/react";
import type { CommandExecuteRequest, CommandExecuteResponse } from "@pstdio/sdk/api";
import { getThemePreferenceMode, type ThemePreference } from "@pstdio/ui";
import {
  createWorkbenchWebviewHostCapabilities,
  refreshOpenWorkbenchExtensionWebviews,
  refreshWorkbenchExtensionContributions,
  registerWorkbenchExtensionContributions,
  text,
} from "pstdio-extensions/workbench";
import {
  createWorkbenchCore,
  type ResourceRef,
  type WorkbenchCore,
  workbenchCommandPaletteMenuPath,
} from "pstdio-workbench/core";
import { createWorkbenchSettingsModule, Workbench } from "pstdio-workbench/react";
import { useRef, useState } from "react";
import type { ExtensionBenchLoadResponse } from "../lib/api-contract";
import type { CommandCallLogEntry } from "../lib/command-call-log";
import { createPreviewResource } from "../lib/preview-resource";
import { createPreviewWebviewFileHost } from "../lib/webview-files";
import { registerContentContributionWidgets } from "./content-contribution-panel";
import { ContributionExplorer } from "./contribution-explorer";

const primaryRendererId = "extension-testbench.primary.renderer";
const primaryWidgetId = "extension-testbench.primary";
const syntheticTreeWidgetId = "extension-testbench.tree";

export interface ExtensionHostCommandEvent {
  commandId: string;
  extensionId: string;
  outcome: CommandExecuteResponse["outcome"];
  tick: number;
}

type CommandCallRecorder = (entry: CommandCallLogEntry) => void;

type ExecuteWorkbenchCommand = (commandId: string, request: CommandExecuteRequest) => Promise<CommandExecuteResponse>;

type ExtensionWorkbenchPreviewProps = {
  bench: ExtensionBenchLoadResponse;
  executeCommand: ExecuteWorkbenchCommand;
  lastCommand: ExtensionHostCommandEvent | null;
  onCommandCall: CommandCallRecorder;
  setThemePreference: (themePreference: ThemePreference) => void;
  themePreference: ThemePreference;
};

type CreatePreviewWorkbenchProps = ExtensionWorkbenchPreviewProps & {
  getLastCommand: () => ExtensionHostCommandEvent | null;
  getThemePreference: () => ThemePreference;
  publishLastCommand: (commandId: string, response: CommandExecuteResponse) => ExtensionHostCommandEvent;
};

const createCallId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const PrimaryPanel = (props: { bench: ExtensionBenchLoadResponse; resource?: ResourceRef }) => {
  const { bench, resource } = props;
  const extension = bench.metadata.extensions[0];

  return (
    <Box as="section" alignContent="start" display="grid" gap="4" h="full" minH="0" overflow="auto" p="6">
      <Box>
        <Text color="fg.muted" fontSize="xs" fontWeight="700" mb="1" textTransform="uppercase">
          {resource?.kind ?? "resource"}
        </Text>
        <Text as="h1" fontSize="2xl" fontWeight="600" lineHeight="1.2">
          {resource?.label ?? "Preview resource"}
        </Text>
      </Box>
      <SimpleGrid as="dl" columns={{ base: 1, md: 2 }} gap="2" m="0" maxW="760px">
        <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
          <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
            Extension
          </Text>
          <Text as="dd" fontSize="sm" m="0" overflowWrap="anywhere">
            {extension?.displayName ?? extension?.name ?? "Unknown"}
          </Text>
        </Box>
        <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
          <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
            Source
          </Text>
          <Text as="dd" fontSize="sm" m="0" overflowWrap="anywhere">
            {bench.sourcePath}
          </Text>
        </Box>
        <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
          <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
            Views
          </Text>
          <Text as="dd" fontSize="sm" m="0">
            {bench.summary.views}
          </Text>
        </Box>
        <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
          <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
            Tree renderers
          </Text>
          <Text as="dd" fontSize="sm" m="0">
            {bench.summary.treeRenderers}
          </Text>
        </Box>
        <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
          <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
            Templates
          </Text>
          <Text as="dd" fontSize="sm" m="0">
            {bench.summary.templates}
          </Text>
        </Box>
        <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
          <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
            Skills
          </Text>
          <Text as="dd" fontSize="sm" m="0">
            {bench.summary.skills}
          </Text>
        </Box>
      </SimpleGrid>
    </Box>
  );
};

const findTreeView = (bench: ExtensionBenchLoadResponse, resource: ResourceRef) =>
  bench.metadata.views.find((view) => view.treeRendererId && view.resourceKind === resource.kind) ??
  bench.metadata.views.find((view) => view.treeRendererId);

const registerResourceKinds = (workbench: WorkbenchCore, bench: ExtensionBenchLoadResponse, resource: ResourceRef) => {
  const kinds = new Set([resource.kind]);
  for (const view of bench.metadata.views) {
    if (view.resourceKind) kinds.add(view.resourceKind);
  }

  for (const kind of kinds) {
    workbench.resources.registerKind({
      kind,
      label: kind,
      icon: "FileText",
      surface: kind === resource.kind ? "primary" : undefined,
    });
  }
};

const openPrimaryResource = (workbench: WorkbenchCore, resource: ResourceRef, bench: ExtensionBenchLoadResponse) => {
  workbench.renderers.registerRenderer({
    id: primaryRendererId,
    render: ({ placement }) => <PrimaryPanel bench={bench} resource={placement.resource} />,
  });
  workbench.layout.registerWidget({
    id: primaryWidgetId,
    title: "Preview",
    area: "main",
    rendererId: primaryRendererId,
    singleton: false,
  });
  workbench.resources.registerOpener({
    id: "extension-testbench.resource-opener",
    canOpen: (candidate) => candidate.kind === resource.kind,
    open: (candidate, input) =>
      workbench.layout.openWidget(primaryWidgetId, {
        replaceActive: input.replaceActive,
        resource: candidate,
        title: candidate.label ?? candidate.id ?? candidate.uri,
      }),
  });
  workbench.layout.openWidget(primaryWidgetId, { pinned: true, resource, title: resource.label });
};

const openTreePreview = (workbench: WorkbenchCore, bench: ExtensionBenchLoadResponse, resource: ResourceRef) => {
  const view = findTreeView(bench, resource);

  if (view) {
    workbench.layout.openWidget(view.id, {
      pinned: true,
      resource,
      title: text(view.title, view.id),
    });
    return;
  }

  const renderer = bench.metadata.treeRenderers?.[0];
  if (!renderer) return;

  workbench.layout.registerWidget({
    id: syntheticTreeWidgetId,
    title: text(renderer.title, renderer.id),
    area: "main-left",
    rendererId: renderer.id,
    resourceKinds: [resource.kind],
  });
  workbench.layout.openWidget(syntheticTreeWidgetId, {
    pinned: true,
    resource,
    title: text(renderer.title, renderer.id),
  });
};

const registerCommandPaletteEntries = (workbench: WorkbenchCore, bench: ExtensionBenchLoadResponse) => {
  const extension = bench.metadata.extensions[0];
  const group = extension?.displayName ?? extension?.name ?? "Extension commands";

  bench.metadata.commands.forEach((command, index) => {
    workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: command.id,
      description: text(command.description),
      group,
      label: text(command.title, command.id),
      order: index,
    });
  });
};

const createPreviewWorkbench = (props: CreatePreviewWorkbenchProps) => {
  const {
    bench,
    executeCommand,
    getLastCommand,
    getThemePreference,
    onCommandCall,
    publishLastCommand,
    setThemePreference,
  } = props;
  const workbench = createWorkbenchCore();
  const resource = createPreviewResource(bench.metadata);
  const webviewFiles = createPreviewWebviewFileHost();

  workbench.registerModule(
    createWorkbenchSettingsModule({
      resolveScopeId: (scope) => (scope === "project" ? bench.projectId : scope),
      title: "Extension settings",
    }),
  );

  registerWorkbenchExtensionContributions({
    executeCommand: async (commandId, request) => {
      const id = createCallId();
      onCommandCall({ commandId, id, request, status: "pending" });

      try {
        const response = await executeCommand(commandId, request);
        const event = publishLastCommand(commandId, response);
        workbench.context.set("extensionTestbench.lastCommandTick", event.tick);
        refreshWorkbenchExtensionContributions(workbench, bench.metadata, commandId);
        onCommandCall({ commandId, id, request, response, status: "success" });
        return response;
      } catch (error) {
        onCommandCall({
          commandId,
          error: error instanceof Error ? error.message : String(error),
          id,
          request,
          status: "error",
        });
        throw error;
      }
    },
    metadata: bench.metadata,
    projectId: bench.projectId,
    createWebviewHostCapabilityOverrides: (context) => {
      const workbenchCapabilities = createWorkbenchWebviewHostCapabilities({ workbench: context.workbench });

      return {
        "preferences.get": (params) => {
          const request = params as { name: string };
          if (request.name === "dashboard.themePreference") return getThemePreference();
          return workbenchCapabilities["preferences.get"]?.(params);
        },
        "preferences.set": (params) => {
          const request = params as { name: string; value: ThemePreference };
          if (request.name !== "dashboard.themePreference") {
            return workbenchCapabilities["preferences.set"]?.(params);
          }

          setThemePreference(request.value);
          workbench.context.set("extensionTestbench.themePreference", request.value);
          refreshOpenWorkbenchExtensionWebviews(workbench, bench.metadata);
          return { name: request.name, value: request.value };
        },
      };
    },
    createWebviewProps: ({ placement }) => ({
      lastCommand: getLastCommand() ?? undefined,
      placement,
      projectId: bench.projectId,
      resource: placement.resource,
      themePreference: getThemePreference(),
    }),
    createWebviewTheme: () => getThemePreferenceMode(getThemePreference()),
    webviewFiles,
    workbench,
  });
  registerContentContributionWidgets(workbench, bench);
  registerCommandPaletteEntries(workbench, bench);

  void workbench.resources.openResource(resource).catch(() => {
    registerResourceKinds(workbench, bench, resource);
    openPrimaryResource(workbench, resource, bench);
    openTreePreview(workbench, bench, resource);
  });

  return workbench;
};

export const ExtensionWorkbenchPreview = (props: ExtensionWorkbenchPreviewProps) => {
  const { bench } = props;
  const lastCommandRef = useRef(props.lastCommand);
  const commandTickRef = useRef(props.lastCommand?.tick ?? 0);
  const themePreferenceRef = useRef(props.themePreference);
  lastCommandRef.current = props.lastCommand;
  themePreferenceRef.current = props.themePreference;
  const [workbench] = useState(() =>
    createPreviewWorkbench({
      ...props,
      getLastCommand: () => lastCommandRef.current,
      getThemePreference: () => themePreferenceRef.current,
      publishLastCommand: (commandId, response) => {
        const event = {
          commandId,
          extensionId: response.extensionId,
          outcome: response.outcome,
          tick: commandTickRef.current + 1,
        };
        commandTickRef.current = event.tick;
        lastCommandRef.current = event;
        return event;
      },
      setThemePreference: (themePreference) => {
        themePreferenceRef.current = themePreference;
        props.setThemePreference(themePreference);
      },
    }),
  );
  const [resource] = useState(() => createPreviewResource(bench.metadata));

  return (
    <Box display="grid" gridTemplateRows="auto minmax(0, 1fr)" h="full" minH="0" minW="0">
      <ContributionExplorer bench={bench} resource={resource} workbench={workbench} />
      <Box minH="0" minW="0" overflow="hidden">
        <Workbench workbench={workbench} />
      </Box>
    </Box>
  );
};
