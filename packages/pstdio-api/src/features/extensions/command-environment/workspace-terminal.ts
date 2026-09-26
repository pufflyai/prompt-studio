import type { ExtensionTerminalApi, TerminalEvent, TerminalSessionHandle } from "pstdio-api-contracts/extension-kernel";

// A terminal handle is synchronous; target lookup completes before the host opens its PTY.
export const createWorkspaceTerminal = (
  terminal: ExtensionTerminalApi,
  resolveCwd: () => Promise<string>,
): ExtensionTerminalApi => ({
  openSession(request) {
    let session: TerminalSessionHandle | undefined;
    let failure: unknown;
    let killed = false;
    let consumed = false;
    const pending: Array<(handle: TerminalSessionHandle) => void> = [];
    const ready = resolveCwd()
      .then((cwd) => {
        if (killed) return;
        session = terminal.openSession({ ...request, cwd: request.cwd ?? cwd });
        for (const operation of pending.splice(0)) operation(session);
      })
      .catch((error: unknown) => {
        failure = error;
        pending.length = 0;
      });
    const dispatch = (operation: (handle: TerminalSessionHandle) => void) => {
      if (killed || failure) return;
      if (session) operation(session);
      else pending.push(operation);
    };
    return {
      id: crypto.randomUUID(),
      write: (data) => dispatch((handle) => handle.write(data)),
      resize: (cols, rows) => dispatch((handle) => handle.resize(cols, rows)),
      async kill(signal) {
        killed = true;
        pending.length = 0;
        await session?.kill(signal);
      },
      events() {
        if (consumed) throw new Error("Terminal session already has an active iterator");
        consumed = true;
        return (async function* (): AsyncIterable<TerminalEvent> {
          await ready;
          if (session) yield* session.events();
          else {
            if (failure && !killed)
              yield { kind: "error", message: failure instanceof Error ? failure.message : String(failure) };
            yield { kind: "exit", code: null, signal: null };
          }
        })();
      },
    };
  },
});
