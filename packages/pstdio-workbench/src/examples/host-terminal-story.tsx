import { Box, Button, Stack, Text } from "@chakra-ui/react";
import { createScriptedTerminalBridge } from "@pstdio/ui/terminal";
import { createWorkbench, type WorkbenchCoreContributionContext, type WorkbenchLayout } from "../core";
import {
  createWorkbenchTerminalModule,
  openWorkbenchTerminal,
  WORKBENCH_TERMINAL_OPEN_COMMAND_ID,
} from "../react/terminal/terminal-module";

const notesWidgetId = "host-terminal-story.notes";
const launcherWidgetId = "host-terminal-story.launcher";
const createHostTerminalModule = () => ({
  id: "host-terminal-story",
  activate(ctx: WorkbenchCoreContributionContext) {
    const scriptedTerminal = createScriptedTerminalBridge({
      initial: [{ data: "workbench host terminal (scripted)\r\n$ " }],
    });
    ctx.terminal.setSessionOpener((request) => scriptedTerminal.openSession(request));
    const terminalDisposables = createWorkbenchTerminalModule().activate(ctx);
    const launcherView = ctx.views.registerView({
      id: launcherWidgetId,
      title: "Terminal launcher",
      body: {
        kind: "react",
        render: ({ workbench }) => (
          <Stack h="full" gap="md" p="lg" bg="bg">
            <Stack gap="xs">
              <Text textStyle="heading/M/semibold">Host terminals</Text>
              <Text color="fg.muted">
                Each open creates a separate terminal resource and a new tab in the Secondary panel.
              </Text>
            </Stack>
            <Button
              alignSelf="flex-start"
              onClick={() => void workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID)}
            >
              Open another terminal
            </Button>
            <Text color="fg.muted" textStyle="paragraph/XS/regular">
              You can also use the + menu in the Secondary panel.
            </Text>
          </Stack>
        ),
      },
    });
    const launcherPlacement = ctx.shellPlacements.registerPlacement({
      id: launcherWidgetId,
      item: {
        kind: "view",
        presence: "fixed",
        view: {
          kind: "view",
          id: launcherWidgetId,
        },
      },
      region: "main",
    });
    const notesView = ctx.views.registerView({
      id: notesWidgetId,
      title: "notes.md",
      body: {
        kind: "react",
        render: () => (
          <Box h="full" w="full" p="md" bg="bg" color="fg">
            <Text textStyle="label/S/medium">notes.md</Text>
            <Text mt="sm" textStyle="paragraph/S/regular" color="fg.muted">
              build: ready
              <br />
              owner: workbench
            </Text>
          </Box>
        ),
      },
    });
    const notesPlacement = ctx.shellPlacements.registerPlacement({
      id: notesWidgetId,
      item: {
        kind: "view",
        presence: "closed",
        view: {
          kind: "view",
          id: notesWidgetId,
        },
      },
      region: "secondary",
    });
    return [
      ...(Array.isArray(terminalDisposables) ? terminalDisposables : terminalDisposables ? [terminalDisposables] : []),
      launcherView,
      launcherPlacement,
      notesView,
      notesPlacement,
    ];
  },
});
const setupHostTerminalWorkbench = (layoutPersistence?: {
  getLayout: (scope?: string) => WorkbenchLayout | undefined;
  setLayout: (layout: WorkbenchLayout, scope?: string) => void;
}) => {
  const workbench = createWorkbench({ layoutPersistence });
  workbench.registerModule(createHostTerminalModule());
  return workbench;
};
export const createHostTerminalWorkbench = () => {
  const workbench = setupHostTerminalWorkbench();
  openWorkbenchTerminal(workbench);
  workbench.shellPlacements.openPlacement({ placementId: notesWidgetId });
  return workbench;
};
export const createRestoredHostTerminalWorkbench = () => {
  const layouts = new Map<string | undefined, WorkbenchLayout>();
  const layoutPersistence = {
    getLayout: (scope?: string) => layouts.get(scope),
    setLayout: (layout: WorkbenchLayout, scope?: string) => layouts.set(scope, structuredClone(layout)),
  };
  const scope = "project/project-1/mode/review";
  const source = setupHostTerminalWorkbench(layoutPersistence);
  source.layout.setPersistenceScope(scope);
  openWorkbenchTerminal(source);
  source.shellPlacements.openPlacement({ placementId: notesWidgetId });
  const restored = setupHostTerminalWorkbench(layoutPersistence);
  restored.layout.setPersistenceScope(scope);
  return restored;
};
