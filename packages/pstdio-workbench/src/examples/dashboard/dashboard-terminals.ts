import { createScriptedTerminalBridge } from "@pstdio/ui/terminal";
import type { WorkbenchCoreContributionContext } from "../../core";
import { createWorkbenchTerminalModule, openWorkbenchTerminal, WORKBENCH_TERMINAL_WIDGET_ID } from "../../react";

const openSampleSession = (request: { cols: number; rows: number; cwd?: string }) => {
  const cwd = request.cwd ?? "/projects/website";
  let command = "";
  const bridge = createScriptedTerminalBridge({
    initial: [{ data: `Sample shell · ${cwd}\r\nTry pwd, ls, help, or clear. No system commands run.\r\n$ ` }],
    onInput: (input) => {
      let output = "";
      for (const character of input) {
        if (character === "\r") {
          const commands: Record<string, string> = {
            pwd: cwd,
            ls: "README.md   src/   package.json",
            help: "Sample commands: pwd, ls, clear, help.",
          };
          if (command.trim() === "clear") output += "\x1b[2J\x1b[H$ ";
          else output += `\r\n${commands[command.trim()] ?? "Try pwd, ls, clear, or help."}\r\n$ `;
          command = "";
        } else if (character === "\x7f") {
          if (command) output += "\b \b";
          command = command.slice(0, -1);
        } else {
          command += character;
          output += character;
        }
      }
      return [{ data: output }];
    },
  });
  return bridge.openSession(request);
};

export const createDashboardTerminalModule = (openedWorkspaces: Set<string>) => ({
  id: "dashboard.sample-terminals",
  activate(ctx: WorkbenchCoreContributionContext) {
    ctx.terminal.setSessionOpener(openSampleSession);
    const terminalDisposables = createWorkbenchTerminalModule().activate(ctx);
    const ensureTerminal = () => {
      const resource = ctx.pages.store.getState().location?.resource;
      if (resource?.type !== "demo.workspace" || openedWorkspaces.has(resource.id)) return;
      openedWorkspaces.add(resource.id);
      const existing = ctx.shellPlacements
        .resolvePlacements()
        .some(
          (placement) =>
            placement.identity.kind === "shell" &&
            placement.identity.placementId === WORKBENCH_TERMINAL_WIDGET_ID &&
            placement.value.resource?.metadata?.workspaceId === resource.id,
        );
      if (!existing) openWorkbenchTerminal(ctx, { resource });
    };
    const unsubscribe = ctx.pages.store.subscribe(ensureTerminal);
    return [...(terminalDisposables ? [terminalDisposables].flat() : []), { dispose: unsubscribe }];
  },
});
