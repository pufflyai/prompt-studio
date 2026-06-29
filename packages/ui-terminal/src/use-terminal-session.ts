import { useEffect, useState } from "react";
import type {
  TerminalBridge,
  TerminalSessionAdapter,
  TerminalSessionError,
  TerminalSessionExit,
  TerminalSessionRequest,
} from "./types";

export type TerminalSessionStatus = "idle" | "opening" | "open" | "exited" | "error";

export interface UseTerminalSessionResult {
  session: TerminalSessionAdapter | null;
  status: TerminalSessionStatus;
  exit: TerminalSessionExit | null;
  error: TerminalSessionError | null;
}

export interface UseTerminalSessionOptions {
  bridge: TerminalBridge | null;
  request: TerminalSessionRequest;
  /** Set to false to keep the session alive when the hook unmounts. */
  killOnUnmount?: boolean;
}

export const createTerminalSessionRequestKey = (request: TerminalSessionRequest) =>
  JSON.stringify({
    command: request.command,
    cwd: request.cwd,
    env: request.env
      ? Object.fromEntries(Object.entries(request.env).sort(([left], [right]) => left.localeCompare(right)))
      : undefined,
    cols: request.cols,
    rows: request.rows,
  });

const readTerminalSessionRequestKey = (requestKey: string): TerminalSessionRequest => JSON.parse(requestKey);

/**
 * Opens a terminal session via the provided bridge and surfaces its lifecycle
 * for the renderer. The session is killed on unmount unless explicitly opted
 * out; switching bridges or request contents triggers a fresh open.
 */
export const useTerminalSession = ({ bridge, request, killOnUnmount = true }: UseTerminalSessionOptions) => {
  const requestKey = createTerminalSessionRequestKey(request);
  const [state, setState] = useState<UseTerminalSessionResult>({
    session: null,
    status: "idle",
    exit: null,
    error: null,
  });

  useEffect(() => {
    if (!bridge) {
      setState({ session: null, status: "idle", exit: null, error: null });
      return;
    }

    let cancelled = false;
    let activeSession: TerminalSessionAdapter | null = null;
    let terminalState: TerminalSessionStatus = "opening";
    const disposers: Array<() => void> = [];

    setState({ session: null, status: "opening", exit: null, error: null });
    const requestSnapshot = readTerminalSessionRequestKey(requestKey);

    bridge
      .openSession(requestSnapshot)
      .then((session) => {
        if (cancelled) {
          void session.kill();
          return;
        }
        activeSession = session;
        disposers.push(
          session.onExit((exit) => {
            terminalState = "exited";
            setState((prev) => ({ ...prev, status: "exited", exit }));
          }),
          session.onError((error) => {
            terminalState = "error";
            setState((prev) => ({ ...prev, status: "error", error }));
          }),
        );
        terminalState = "open";
        setState({ session, status: "open", exit: null, error: null });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : String(cause);
        terminalState = "error";
        setState({ session: null, status: "error", exit: null, error: { message } });
      });

    return () => {
      cancelled = true;
      while (disposers.length > 0) disposers.pop()?.();
      if (killOnUnmount && activeSession && terminalState !== "exited") void activeSession.kill();
    };
  }, [bridge, requestKey, killOnUnmount]);

  return state;
};
