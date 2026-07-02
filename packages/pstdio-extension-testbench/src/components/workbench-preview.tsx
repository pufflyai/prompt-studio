import { Box } from "@chakra-ui/react";
import type { CommandExecuteRequest, CommandExecuteResponse } from "@pstdio/sdk/api";
import { getThemePreferenceMode, type ThemePreference, type ThemePreferenceOption } from "@pstdio/ui";
import { createScriptedTerminalBridge } from "@pstdio/ui/terminal";
import { text } from "pstdio-extensions/workbench";
import { createWorkbenchCore } from "pstdio-workbench/core";
import {
  createWorkbenchWebviewHostCapabilities,
  refreshOpenWorkbenchExtensionWebviews,
  refreshWorkbenchExtensionContributions,
  registerWorkbenchExtensionContributions,
} from "pstdio-workbench/extensions";
import { createWorkbenchSettingsModule, createWorkbenchTerminalModule, Workbench } from "pstdio-workbench/react";
import { useRef, useState } from "react";
import type { ExtensionBenchLoadResponse } from "../lib/api-contract";
import type { CommandCallLogEntry } from "../lib/command-call-log";
import { createPreviewResource } from "../lib/preview-resource";
import { createPreviewWebviewFileHost } from "../lib/webview-files";
import { surfaceCommandOutcome } from "./command-outcome";
import { registerContentContributionWidgets } from "./content-contribution-panel";
import { ContributionExplorer } from "./contribution-explorer";
import {
  openPrimaryResource,
  openTreePreview,
  registerPreviewResourceProvider,
  registerResourceKinds,
} from "./preview-surfaces";

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

export const extensionThemePreferences = (bench: ExtensionBenchLoadResponse) =>
  bench.inventory.themes.map(
    (theme) =>
      ({
        id: theme.id,
        title: text(theme.title, theme.id),
        mode: theme.mode,
        tokens: theme.tokens,
        monacoTheme: theme.monacoTheme,
      }) satisfies ThemePreferenceOption,
  );

export const createPreviewWorkbench = (props: CreatePreviewWorkbenchProps) => {
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

  workbench.themes.register(extensionThemePreferences(bench));

  workbench.registerModule(
    createWorkbenchSettingsModule({
      resolveScopeId: (scope) => (scope === "project" ? bench.projectId : scope),
      title: "Extension settings",
    }),
  );

  // Deterministic scripted terminal backend: the testbench never spawns real
  // shells. Both the host-owned terminal panel and webviews declaring
  // `terminal.session` run against this same scripted session registry.
  const scriptedTerminal = createScriptedTerminalBridge({
    initial: [{ data: "pstdio extension testbench (scripted terminal)\r\n$ " }],
  });
  workbench.terminal.setSessionOpener((request) => scriptedTerminal.openSession(request));
  workbench.registerModule(createWorkbenchTerminalModule());

  registerWorkbenchExtensionContributions({
    executeCommand: async (commandId, request) => {
      const id = createCallId();
      onCommandCall({ commandId, id, request, status: "pending" });

      try {
        const response = await executeCommand(commandId, request);
        surfaceCommandOutcome(workbench, response);
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
  registerPreviewResourceProvider(workbench, bench);

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
