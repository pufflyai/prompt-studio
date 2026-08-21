import { Box, Text } from "@chakra-ui/react";
import { createScriptedTerminalBridge } from "@pstdio/ui/terminal";
import { createWorkbenchCore, type WorkbenchCoreContributionContext, type WorkbenchLayout } from "../core";
import {
  createWorkbenchTerminalModule,
  openWorkbenchTerminal,
  WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
} from "../react/terminal/terminal-module";

const notesWidgetId = "host-terminal-story.notes";
const notesRendererId = "host-terminal-story.notes.renderer";

const createHostTerminalModule = () => ({
  id: "host-terminal-story",
  activate(ctx: WorkbenchCoreContributionContext) {
    const scriptedTerminal = createScriptedTerminalBridge({
      initial: [{ data: "workbench host terminal (scripted)\r\n$ " }],
    });
    ctx.terminal.setSessionOpener((request) => scriptedTerminal.openSession(request));
    const terminalDisposables = createWorkbenchTerminalModule().activate(ctx);
    const notesWidget = ctx.layout.registerPanel({
      id: notesWidgetId,
      title: "notes.md",
      region: "secondary",
      singleton: true,
      eligibleLocations: {},
      rendererId: notesRendererId,
    });
    const notesRenderer = ctx.renderers.registerRenderer({
      id: notesRendererId,
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
    });
    return [
      ...(Array.isArray(terminalDisposables) ? terminalDisposables : terminalDisposables ? [terminalDisposables] : []),
      notesWidget,
      notesRenderer,
    ];
  },
});

const setupHostTerminalWorkbench = (layoutPersistence?: {
  getLayout: (scope?: string) => WorkbenchLayout | undefined;
  setLayout: (layout: WorkbenchLayout, scope?: string) => void;
}) => {
  const workbench = createWorkbenchCore({ layoutPersistence });
  workbench.registerModule(createHostTerminalModule());
  return workbench;
};

export const createHostTerminalWorkbench = () => {
  const workbench = setupHostTerminalWorkbench();
  openWorkbenchTerminal(workbench);
  openWorkbenchTerminal(workbench);
  workbench.layout.openPanel(notesWidgetId, { title: "notes.md" });
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
  source.layout.openPanel(notesWidgetId, { title: "notes.md", strategy: { kind: "persistent" } });
  source.layout.setRegionActiveWidget("secondary", WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID);

  const restored = setupHostTerminalWorkbench(layoutPersistence);
  restored.layout.setPersistenceScope(scope);
  return restored;
};
