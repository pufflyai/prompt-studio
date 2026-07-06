import "@xterm/xterm/css/xterm.css";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal as Xterm } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import { useLabHost } from "../hooks/host-context";
import { createLabView } from "../renderers/lab-view-shell";

const TERMINAL_CAPABILITY = "terminal.session";

type TerminalHostEvent =
  | { sessionId: string; kind: "data"; chunk: Uint8Array }
  | { sessionId: string; kind: "exit"; code: number | null; signal: string | null };

// The webview bundle resolves @pstdio/sdk and @pstdio/ui from the npm registry, so the
// unreleased `createTerminalSessionBridge` and `@pstdio/ui/terminal` surfaces are not
// available here yet. This view speaks the `terminal.session` capability protocol
// directly over `host.call`/`host.onEvent`; swap to the SDK bridge and the shared
// <Terminal /> component once releases with the terminal surface ship.
const LabTerminal = () => {
  const { host } = useLabHost();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const xterm = new Xterm({ cursorBlink: true, fontSize: 13 });
    const fit = new FitAddon();
    xterm.loadAddon(fit);
    xterm.open(container);
    fit.fit();

    let disposed = false;
    const disposables: (() => void)[] = [() => xterm.dispose()];

    const call = (operation: Record<string, unknown>) => host.call(TERMINAL_CAPABILITY, operation);

    const start = async () => {
      const opened = (await call({
        operation: "open",
        request: { cols: xterm.cols, rows: xterm.rows },
      })) as { sessionId: string };
      const sessionId = opened.sessionId;

      if (disposed) {
        void call({ operation: "kill", sessionId });
        return;
      }
      disposables.push(() => void call({ operation: "kill", sessionId }));

      disposables.push(
        host.onEvent(TERMINAL_CAPABILITY, (payload) => {
          const event = payload as TerminalHostEvent;
          if (event.sessionId !== sessionId) return;
          if (event.kind === "data") {
            xterm.write(event.chunk);
            return;
          }
          xterm.write("\r\n[session exited]\r\n");
        }),
      );
      await call({ operation: "subscribe", sessionId });

      const input = xterm.onData((data) => void call({ operation: "write", sessionId, data }));
      disposables.push(() => input.dispose());

      const observer = new ResizeObserver(() => {
        fit.fit();
        void call({ operation: "resize", sessionId, cols: xterm.cols, rows: xterm.rows });
      });
      observer.observe(container);
      disposables.push(() => observer.disconnect());
    };

    void start().catch((error) => {
      const message =
        error instanceof Error ? error.message : ((error as { message?: string })?.message ?? JSON.stringify(error));
      xterm.write(`\r\n[terminal unavailable: ${message}]\r\n`);
    });

    return () => {
      disposed = true;
      for (const dispose of disposables.reverse()) dispose();
    };
  }, [host]);

  return (
    <div
      ref={containerRef}
      data-testid="lab-terminal"
      style={{ height: "100vh", width: "100%", background: "#000", padding: "8px", boxSizing: "border-box" }}
    />
  );
};

export default createLabView(() => <LabTerminal />);
