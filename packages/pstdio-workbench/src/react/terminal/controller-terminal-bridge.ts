import type { TerminalBridge } from "@pstdio/ui/terminal";
import type { ResourceRef, WorkbenchTerminalController } from "../../core";

interface ControllerTerminalBridgeOptions {
  getBindingId?: () => string | undefined;
  getResource?: () => ResourceRef | undefined;
  getTitle?: () => string | undefined;
}

const workspacePathFromResource = (resource: ResourceRef | undefined) => {
  const workspacePath = resource?.metadata?.workspacePath;
  return typeof workspacePath === "string" && workspacePath.length > 0 ? workspacePath : undefined;
};

const withTerminalRequestDefaults = (
  request: Parameters<TerminalBridge["openSession"]>[0],
  resource: ResourceRef | undefined,
) => {
  const cwd = workspacePathFromResource(resource);
  return cwd && !request.cwd ? { ...request, cwd } : request;
};

// Adapts the core terminal controller to the renderer-side `TerminalBridge`
// contract. Sessions opened by the panel land in the same controller registry
// the `terminal.session` webview capability uses, so host UI and extension
// webviews always see one session registry.
export const createControllerTerminalBridge = (
  terminal: WorkbenchTerminalController,
  options: ControllerTerminalBridgeOptions = {},
): TerminalBridge => ({
  async openSession(request) {
    const { sessionId } = await terminal.open({
      bindingId: options.getBindingId?.(),
      request: withTerminalRequestDefaults(request, options.getResource?.()),
      title: options.getTitle?.(),
    });
    return {
      id: sessionId,
      write: (data) => terminal.write({ sessionId, data }),
      resize: (cols, rows) => terminal.resize({ sessionId, cols, rows }),
      kill: (signal) => terminal.kill({ sessionId, signal }),
      onData: (handler) => terminal.subscribe(sessionId, { onData: handler }),
      onExit: (handler) => terminal.subscribe(sessionId, { onExit: handler }),
      onError: (handler) => terminal.subscribe(sessionId, { onError: handler }),
    };
  },
});
