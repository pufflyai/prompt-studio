import type { TerminalSessionAdapter } from "./types";

/**
 * Minimal subset of xterm.js that the binding needs. Tests substitute a fake
 * sink so the wire-up logic can be exercised without a DOM.
 */
export interface TerminalSink {
  write(data: string | Uint8Array): void;
  onInput(handler: (data: string) => void): () => void;
  onResize(handler: (size: { cols: number; rows: number }) => void): () => void;
}

export interface BindSessionOptions {
  /** Forwarded to the session when the user types in the sink. */
  onInput?: (data: string) => void;
  /** Called once the session exits; useful for surfacing status. */
  onExit?: (exit: { code: number | null; signal: string | null }) => void;
  /** Called on transport errors. */
  onError?: (error: { message: string }) => void;
}

/**
 * Wires a {@link TerminalSink} (typically xterm.js) to a
 * {@link TerminalSessionAdapter}. Returns a disposer that detaches every
 * subscription it created. The session itself is *not* killed — owning the
 * session lifecycle is the caller's responsibility.
 */
export const bindSessionToSink = (
  sink: TerminalSink,
  session: TerminalSessionAdapter,
  options: BindSessionOptions = {},
) => {
  const disposers: Array<() => void> = [];

  disposers.push(session.onData((chunk) => sink.write(chunk)));

  disposers.push(
    sink.onInput((data) => {
      session.write(data);
      options.onInput?.(data);
    }),
  );

  disposers.push(
    sink.onResize(({ cols, rows }) => {
      session.resize(cols, rows);
    }),
  );

  if (options.onExit) disposers.push(session.onExit(options.onExit));
  if (options.onError) disposers.push(session.onError(options.onError));

  return () => {
    while (disposers.length > 0) {
      const dispose = disposers.pop();
      try {
        dispose?.();
      } catch {
        // Disposer errors during teardown are intentionally swallowed so a
        // partially-bound session still cleans up the remaining subscriptions.
      }
    }
  };
};
