import { FitAddon } from "@xterm/addon-fit";
import type { ITheme } from "@xterm/xterm";
import { Terminal as Xterm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import "./terminal.css";
import { useEffect, useRef } from "react";
import { bindSessionToSink, type TerminalSink } from "./bind-session";
import { resolveTerminalTheme, type TerminalThemeName } from "./terminal-theme";
import type { TerminalBridge, TerminalSessionAdapter, TerminalSessionRequest } from "./types";
import { useTerminalSession } from "./use-terminal-session";

const DEFAULT_FONT_FAMILY = '"JetBrains Mono", "Fira Code", Menlo, Consolas, monospace';
const DEFAULT_FONT_SIZE = 13;
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

export const createInitialTerminalSessionRequest = (
  request?: Partial<TerminalSessionRequest>,
): TerminalSessionRequest => ({
  ...request,
  cols: request?.cols ?? DEFAULT_COLS,
  rows: request?.rows ?? DEFAULT_ROWS,
});

const createSink = (xterm: Xterm): TerminalSink => ({
  write(data) {
    xterm.write(data);
  },
  onInput(handler) {
    const disposable = xterm.onData(handler);
    return () => disposable.dispose();
  },
  onResize(handler) {
    const disposable = xterm.onResize(handler);
    return () => disposable.dispose();
  },
});

const fitTerminal = (fit: FitAddon | null) => {
  try {
    fit?.fit();
  } catch {
    // fit() throws if the container has zero size (e.g. hidden via CSS).
  }
};

export const resizeSessionToTerminalGeometry = (
  terminal: Pick<Xterm, "cols" | "rows">,
  session: Pick<TerminalSessionAdapter, "resize">,
) => {
  session.resize(terminal.cols, terminal.rows);
};

export const bindTerminalSession = (
  terminal: Pick<Xterm, "cols" | "rows">,
  sink: TerminalSink,
  session: TerminalSessionAdapter,
  options: Pick<TerminalProps, "onSessionOpen" | "onSessionExit">,
) => {
  const unbind = bindSessionToSink(sink, session, {
    onExit: options.onSessionExit,
  });
  resizeSessionToTerminalGeometry(terminal, session);
  options.onSessionOpen?.(session.id);
  return unbind;
};

export interface TerminalSessionCallbackRefs {
  onSessionOpen: React.RefObject<TerminalProps["onSessionOpen"]>;
  onSessionExit: React.RefObject<TerminalProps["onSessionExit"]>;
}

export const bindTerminalSessionWithCallbackRefs = (
  terminal: Pick<Xterm, "cols" | "rows">,
  sink: TerminalSink,
  session: TerminalSessionAdapter,
  callbackRefs: TerminalSessionCallbackRefs,
) =>
  bindTerminalSession(terminal, sink, session, {
    onSessionOpen: (sessionId) => callbackRefs.onSessionOpen.current?.(sessionId),
    onSessionExit: (exit) => callbackRefs.onSessionExit.current?.(exit),
  });

export interface TerminalProps {
  /** Bridge adapter the component opens its session through. */
  bridge: TerminalBridge;
  /**
   * Optional initial session request overrides. `cols`/`rows` default to
   * 80x24; container resizes are forwarded after the session opens.
   */
  request?: Partial<TerminalSessionRequest>;
  /** Theme preset name or full xterm theme. */
  theme?: TerminalThemeName | ITheme;
  /** Monospace font family. */
  fontFamily?: string;
  fontSize?: number;
  /** Whether to kill the session when the component unmounts. Defaults to true. */
  killOnUnmount?: boolean;
  /** Forwarded to the container element. */
  className?: string;
  style?: React.CSSProperties;
  /** Called once the session is open; useful for imperative refs. */
  onSessionOpen?: (sessionId: string) => void;
  /** Called once the session exits. */
  onSessionExit?: (exit: { code: number | null; signal: string | null }) => void;
}

/**
 * High-level terminal component. Mounts xterm.js inside a `<div>` and binds it
 * to the session opened from `bridge.openSession(...)`. Resize is driven by
 * `ResizeObserver` so the terminal fills its container and the host PTY
 * geometry stays in sync.
 */
export const Terminal = (props: TerminalProps) => {
  const {
    bridge,
    request,
    theme,
    fontFamily = DEFAULT_FONT_FAMILY,
    fontSize = DEFAULT_FONT_SIZE,
    killOnUnmount = true,
    className,
    style,
    onSessionOpen,
    onSessionExit,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Xterm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const initialSessionRequestRef = useRef<TerminalSessionRequest | null>(null);
  const onSessionOpenRef = useRef(onSessionOpen);
  const onSessionExitRef = useRef(onSessionExit);

  onSessionOpenRef.current = onSessionOpen;
  onSessionExitRef.current = onSessionExit;

  if (!initialSessionRequestRef.current) {
    initialSessionRequestRef.current = createInitialTerminalSessionRequest(request);
  }

  const resolvedTheme = resolveTerminalTheme(theme);

  // Mount xterm once on the container. Theme, font, and size updates flow
  // through the dedicated options-sync effect below to avoid a full remount on
  // every prop change.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const xterm = new Xterm({
      cols: DEFAULT_COLS,
      rows: DEFAULT_ROWS,
      cursorBlink: true,
      convertEol: true,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    xterm.loadAddon(fit);
    xterm.open(container);

    xtermRef.current = xterm;
    fitRef.current = fit;

    const measure = () => fitTerminal(fit);

    measure();
    const animationFrame = window.requestAnimationFrame(measure);
    const timeout = window.setTimeout(measure, 50);
    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
      observer.disconnect();
      xterm.dispose();
      xtermRef.current = null;
      fitRef.current = null;
    };
  }, []);

  useEffect(() => {
    const xterm = xtermRef.current;
    if (!xterm) return;
    xterm.options.theme = resolvedTheme;
    xterm.options.fontFamily = fontFamily;
    xterm.options.fontSize = fontSize;
    fitTerminal(fitRef.current);
  }, [resolvedTheme, fontFamily, fontSize]);

  const { session } = useTerminalSession({ bridge, request: initialSessionRequestRef.current, killOnUnmount });

  useEffect(() => {
    const xterm = xtermRef.current;
    if (!xterm || !session) return;
    fitTerminal(fitRef.current);
    const animationFrame = window.requestAnimationFrame(() => fitTerminal(fitRef.current));
    const sink = createSink(xterm);
    const unbind = bindTerminalSessionWithCallbackRefs(xterm, sink, session, {
      onSessionOpen: onSessionOpenRef,
      onSessionExit: onSessionExitRef,
    });
    // Opening a terminal is an explicit action; hand it the keyboard so the
    // user can type immediately instead of clicking into it first.
    xterm.focus();
    return () => {
      window.cancelAnimationFrame(animationFrame);
      unbind();
    };
  }, [session]);

  // The mount element fills its box absolutely so xterm sizes to the panel
  // rather than growing it: inside a scrollable host, a self-sized terminal
  // would define its own height and never fit, leaving the host to scroll it.
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: typeof resolvedTheme.background === "string" ? resolvedTheme.background : undefined,
        ...style,
      }}
    >
      <div ref={containerRef} className="pstdio-terminal" style={{ position: "absolute", inset: 0 }} />
    </div>
  );
};
