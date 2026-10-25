import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import type { ITheme } from "@xterm/xterm";
import { Terminal as Xterm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import "./terminal.css";
import { useContext, useEffect, useRef, useState } from "react";
import { SplitPanelMotionContext } from "../layout/split-panel-motion-context";
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

export const createTerminalSink = (xterm: Pick<Xterm, "write" | "onData" | "onResize">) => {
  const inputHandlers = new Set<(data: string) => void>();
  const pendingInput: string[] = [];
  const inputDisposable = xterm.onData((data) => {
    if (inputHandlers.size === 0) {
      pendingInput.push(data);
      return;
    }
    for (const handler of inputHandlers) handler(data);
  });

  return {
    write(data: string | Uint8Array) {
      xterm.write(data);
    },
    onInput(handler: (data: string) => void) {
      inputHandlers.add(handler);
      while (pendingInput.length > 0) handler(pendingInput.shift() as string);
      return () => inputHandlers.delete(handler);
    },
    onResize(handler: (size: { cols: number; rows: number }) => void) {
      const disposable = xterm.onResize(handler);
      return () => disposable.dispose();
    },
    dispose() {
      inputDisposable.dispose();
      inputHandlers.clear();
      pendingInput.length = 0;
    },
  } satisfies TerminalSink & { dispose(): void };
};

// Plain URLs and OSC 8 hyperlinks share this handler. xterm's default OSC 8 handler
// asks with confirm() and opens a blank window first, which the desktop app blocks.
const openTerminalLink = (event: MouseEvent, uri: string) => {
  if (event.ctrlKey || event.metaKey) window.open(uri, "_blank", "noopener,noreferrer");
};

const fitTerminal = (fit: FitAddon | null, motionRoot?: HTMLDivElement | null) => {
  // Fit at the final size, while divider dragging and reduced motion stay direct.
  if (
    motionRoot
      ?.getAnimations()
      .some((animation) => animation instanceof CSSTransition && animation.transitionProperty === "--split-size")
  )
    return;
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
  /** Focus the terminal while it is the active surface. Defaults to true. */
  autoFocus?: boolean;
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
    autoFocus = true,
    className,
    style,
    onSessionOpen,
    onSessionExit,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Xterm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sinkRef = useRef<ReturnType<typeof createTerminalSink> | null>(null);
  const focusWhenReadyRef = useRef<(() => void) | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const initialSessionRequestRef = useRef<TerminalSessionRequest | null>(null);
  const onSessionOpenRef = useRef(onSessionOpen);
  const onSessionExitRef = useRef(onSessionExit);

  onSessionOpenRef.current = onSessionOpen;
  onSessionExitRef.current = onSessionExit;

  if (!initialSessionRequestRef.current) {
    initialSessionRequestRef.current = createInitialTerminalSessionRequest(request);
  }

  const resolvedTheme = resolveTerminalTheme(theme);
  const motionRootRef = useContext(SplitPanelMotionContext);

  // Mount xterm once on the container. Theme, font, and size updates flow
  // through the dedicated options-sync effect below to avoid a full remount on
  // every prop change.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let xterm: Xterm | undefined;
    let sink: ReturnType<typeof createTerminalSink> | undefined;
    let measureAnimationFrame: number | undefined;
    let measureTimeout: number | undefined;
    let observer: ResizeObserver | undefined;
    const motionRoot = motionRootRef?.current;
    const measure = () => fitTerminal(fitRef.current, motionRoot);
    const handleMotionEnd = (event: TransitionEvent) => {
      if (event.target === motionRoot && event.propertyName === "--split-size") measure();
    };
    motionRoot?.addEventListener("transitionend", handleMotionEnd);
    motionRoot?.addEventListener("transitioncancel", handleMotionEnd);

    // Deferring construction skips React Strict Mode's disposable probe mount.
    // xterm schedules internal viewport work during construction that otherwise
    // runs after the probe instance has already been disposed.
    const initializationFrame = window.requestAnimationFrame(() => {
      xterm = new Xterm({
        cols: DEFAULT_COLS,
        rows: DEFAULT_ROWS,
        cursorBlink: true,
        convertEol: true,
        allowProposedApi: true,
        linkHandler: { activate: openTerminalLink },
      });
      const fit = new FitAddon();
      xterm.loadAddon(fit);
      xterm.loadAddon(new WebLinksAddon(openTerminalLink));
      xterm.open(container);
      sink = createTerminalSink(xterm);

      xtermRef.current = xterm;
      fitRef.current = fit;
      sinkRef.current = sink;

      measure();
      measureAnimationFrame = window.requestAnimationFrame(measure);
      measureTimeout = window.setTimeout(measure, 50);
      observer = new ResizeObserver(measure);
      observer.observe(container);
      focusWhenReadyRef.current?.();
      focusWhenReadyRef.current = null;
      setTerminalReady(true);
    });

    return () => {
      window.cancelAnimationFrame(initializationFrame);
      if (measureAnimationFrame !== undefined) window.cancelAnimationFrame(measureAnimationFrame);
      if (measureTimeout !== undefined) window.clearTimeout(measureTimeout);
      observer?.disconnect();
      motionRoot?.removeEventListener("transitionend", handleMotionEnd);
      motionRoot?.removeEventListener("transitioncancel", handleMotionEnd);
      sink?.dispose();
      xterm?.dispose();
      xtermRef.current = null;
      fitRef.current = null;
      sinkRef.current = null;
    };
  }, [motionRootRef]);

  useEffect(() => {
    if (!terminalReady) return;
    const xterm = xtermRef.current;
    if (!xterm) return;
    xterm.options.theme = resolvedTheme;
    xterm.options.fontFamily = fontFamily;
    xterm.options.fontSize = fontSize;
    fitTerminal(fitRef.current, motionRootRef?.current);
  }, [terminalReady, resolvedTheme, fontFamily, fontSize, motionRootRef]);

  const { session } = useTerminalSession({ bridge, request: initialSessionRequestRef.current, killOnUnmount });

  useEffect(() => {
    if (!terminalReady) return;
    const xterm = xtermRef.current;
    const sink = sinkRef.current;
    if (!xterm || !sink || !session) return;
    fitTerminal(fitRef.current, motionRootRef?.current);
    const animationFrame = window.requestAnimationFrame(() => fitTerminal(fitRef.current, motionRootRef?.current));
    const unbind = bindTerminalSessionWithCallbackRefs(xterm, sink, session, {
      onSessionOpen: onSessionOpenRef,
      onSessionExit: onSessionExitRef,
    });
    return () => {
      window.cancelAnimationFrame(animationFrame);
      unbind();
    };
  }, [session, terminalReady, motionRootRef]);

  useEffect(() => {
    if (!autoFocus) return;
    const previousFocus = document.activeElement;
    const focus = () => {
      const current = document.activeElement;
      const container = containerRef.current;
      // Deferred construction must respect a focus choice made after the request.
      if (current === previousFocus || (container && current?.contains(container))) xtermRef.current?.focus();
    };
    if (xtermRef.current) focus();
    else focusWhenReadyRef.current = focus;
    return () => {
      focusWhenReadyRef.current = null;
    };
  }, [autoFocus]);

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
