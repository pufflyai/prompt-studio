import type {
  WebviewHostProps,
  WebviewKeyboardShortcut,
  WebviewKeyboardShortcutRequest,
} from "pstdio-api-contracts/extension-kernel";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { host } from "rimless";
import type {
  ExtensionViewDescriptor,
  GuestApi,
  HostApi,
  HostCapabilityRegistry,
  HostCapabilityRequest,
  ThemePreference,
  WebviewCapabilityDiagnostic,
  WebviewPointerEvent,
} from "../contract";
import { createHostCapabilityGate } from "../contract";
import { createWebviewHostProps } from "../contract/host-props";
import { normalizeRuntimeError } from "../normalize-error";
import { callFrameCapability, frameDimensionChanged } from "./frame-capability";
import type { HostEventPublisher } from "./host-event-publisher";
import { extensionIframeAllow } from "./iframe-permissions";
import { collectChakraThemeVariables, resolveActiveTheme } from "./theme";

export interface ExtensionFrameProps {
  keyboardShortcuts?: readonly WebviewKeyboardShortcut[];
  onShortcut?: (request: WebviewKeyboardShortcutRequest) => void | Promise<void>;
  sizing?: "content-width" | "content-height";
  view: ExtensionViewDescriptor;
  props: Partial<WebviewHostProps> & Record<string, unknown>;
  theme: ThemePreference;
  capabilities?: HostCapabilityRegistry;
  /** Private guest shortcut forwarding, outside extension capability grants. */
  onKeyboardEvent?: (event: import("pstdio-api-contracts").WebviewKeyboardEventParams) => void;
  /** Publisher whose emitted events are forwarded into the guest once connected. */
  hostEvents?: HostEventPublisher;
  onReady?: () => void;
  /** Reports a load or runtime failure. The frame draws no error UI; the caller shows the failure once. */
  onError?: (error: { message: string; stack?: string }) => void;
  onDiagnostics?: (diagnostics: WebviewCapabilityDiagnostic[]) => void;
  title?: string;
}

type GuestRemote = Pick<HostApi, "init" | "themeUpdate" | "propsUpdate"> & {
  hostEvent?: HostApi["hostEvent"];
  keyboardUpdate?: HostApi["keyboardUpdate"];
  restoreFocus?: HostApi["restoreFocus"];
};

const iframeStyle: CSSProperties = {
  border: 0,
  display: "block",
  flex: "1 1 0%",
  height: "100%",
  minHeight: 0,
  width: "100%",
};

const frameShellStyle: CSSProperties = {
  display: "flex",
  height: "100%",
  minHeight: 0,
  position: "relative",
  width: "100%",
};

export const EXTENSION_IFRAME_SANDBOX = "allow-scripts allow-forms allow-popups";
const NO_KEYBOARD_SHORTCUTS: WebviewKeyboardShortcut[] = [];
// Initialization runs after host.connect resolves.
const guestReady = () => {};

export const ExtensionFrame = (props: ExtensionFrameProps) => {
  const {
    view,
    props: extensionProps,
    theme,
    capabilities,
    onKeyboardEvent,
    keyboardShortcuts = NO_KEYBOARD_SHORTCUTS,
    onShortcut,
    hostEvents,
    onReady,
    onError,
    onDiagnostics,
    title,
    sizing,
  } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const remoteRef = useRef<GuestRemote | null>(null);
  const initializedRef = useRef(false);
  // The connection belongs to one browsing context. Navigation keeps the iframe's
  // WindowProxy, so a different contentWindow means the runtime document is gone.
  const connectedWindowRef = useRef<Window | null>(null);
  const propsRef = useRef(createWebviewHostProps(extensionProps));
  const themeRef = useRef(theme);
  const capabilitiesRef = useRef(capabilities);
  const onKeyboardEventRef = useRef(onKeyboardEvent);
  const keyboardRef = useRef({ shortcuts: keyboardShortcuts, onShortcut });
  const hostEventsRef = useRef(hostEvents);
  const declaredCapabilitiesRef = useRef(view.webview.capabilities);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onDiagnosticsRef = useRef(onDiagnostics);
  // Bumped when the browser reloads the iframe (e.g. a DOM reparent while the Side
  // Panel floats). The bump remounts a fresh iframe so a single clean connection
  // owns the new browsing context.
  const [frameEpoch, setFrameEpoch] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  propsRef.current = createWebviewHostProps(extensionProps);
  themeRef.current = theme;
  capabilitiesRef.current = capabilities;
  onKeyboardEventRef.current = onKeyboardEvent;
  keyboardRef.current = { shortcuts: keyboardShortcuts, onShortcut };
  hostEventsRef.current = hostEvents;
  declaredCapabilitiesRef.current = view.webview.capabilities;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;
  onDiagnosticsRef.current = onDiagnostics;

  // Keep one connection per browsing context across StrictMode and unstable parent props.
  // biome-ignore lint/correctness/useExhaustiveDependencies: frameEpoch remounts the iframe this effect reads through iframeRef.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Reinserting the iframe (a DOM move without moveBefore, or StrictMode's dev-only
    // remount of a moved host) replaces its browsing context with about:blank because
    // the src attribute is empty. This can happen before the runtime finishes loading,
    // so compare browsing contexts instead of counting loads. Remount a fresh iframe
    // and connection when the context changed.
    const onFrameLoad = () => {
      if (iframe.contentWindow !== connectedWindowRef.current) setFrameEpoch((epoch) => epoch + 1);
    };
    iframe.addEventListener("load", onFrameLoad);
    const removeLoadListener = () => iframe.removeEventListener("load", onFrameLoad);

    const connectedWindow = iframe.contentWindow;
    if (connectedWindow === connectedWindowRef.current) return removeLoadListener;
    connectedWindowRef.current = connectedWindow;

    // Snapshot styles at connect time so subsequent parent re-renders that produce a
    // new array reference don't affect what we send in init.
    const stylesAtConnect = view.webview.styles;
    const moduleUrlAtConnect = view.webview.moduleUrl;

    const reportDiagnostics = (diagnostics: WebviewCapabilityDiagnostic[]) => {
      if (diagnostics.length > 0) onDiagnosticsRef.current?.(diagnostics);
    };

    const createCapabilityGate = () =>
      createHostCapabilityGate({
        capabilities: capabilitiesRef.current ?? {},
        declaredCapabilities: declaredCapabilitiesRef.current,
        onDiagnostic: (diagnostic) => reportDiagnostics([diagnostic]),
      });

    reportDiagnostics(createCapabilityGate().diagnostics);

    const hostApi = {
      dispatchShortcut: async (request: WebviewKeyboardShortcutRequest) => {
        if (!iframe.isConnected || iframeRef.current !== iframe || document.activeElement !== iframe) return;
        if (
          !keyboardRef.current.shortcuts.some(
            (shortcut) => shortcut.id === request.id && (!request.nested || shortcut.entry),
          )
        )
          return;
        await keyboardRef.current.onShortcut?.(request);
      },
      dispatchPointerEvent: (event: WebviewPointerEvent) => {
        if (iframeRef.current !== iframe || !iframe.isConnected) return;
        if (event.type !== "pointerdown" && event.type !== "click") return;
        const bounds = iframe.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        // Outside-interaction layers need the host iframe as their target, including
        // when the iframe belongs to the menu itself. Guest DOM stays sandboxed.
        iframe.dispatchEvent(
          new PointerEvent(event.type, {
            ...event,
            bubbles: true,
            composed: true,
            cancelable: true,
            clientX: bounds.left + event.clientX * (bounds.width / iframe.clientWidth),
            clientY: bounds.top + event.clientY * (bounds.height / iframe.clientHeight),
          }),
        );
      },
      contentHeightChanged: frameDimensionChanged(sizing === "content-height", setContentHeight),
      contentWidthChanged: frameDimensionChanged(sizing === "content-width", setContentWidth),
      dispatchKeyboardEvent: async (event: import("pstdio-api-contracts").WebviewKeyboardEventParams) => {
        if (onKeyboardEventRef.current) return onKeyboardEventRef.current(event);
        document.dispatchEvent(new KeyboardEvent("keydown", { ...event, bubbles: true, cancelable: true }));
      },
      ready: guestReady,
      runtimeError: (payload: { message: string; stack?: string }) => {
        onErrorRef.current?.(payload);
      },
      call: (request: HostCapabilityRequest) =>
        callFrameCapability(iframe, iframeRef.current, connectedWindow, () => createCapabilityGate().call(request)),
    } satisfies GuestApi;

    const connect = () => {
      initializedRef.current = false;
      remoteRef.current = null;

      const connection = host.connect(iframe, hostApi);
      // A sandboxed iframe without allow-same-origin posts messages with origin "null".
      // Leaving the iframe src attribute empty lets rimless validate the guest by
      // contentWindow identity while still loading the API-owned runtime document.
      iframe.contentWindow?.location.replace(view.webview.runtimeUrl);

      connection
        .then(async (conn) => {
          if (iframeRef.current !== iframe) return;
          const remote = conn.remote as GuestRemote;
          remoteRef.current = remote;
          hostEventsRef.current?.bind((message) => remote.hostEvent?.(message));

          await remote.init({
            keyboardShortcuts: keyboardRef.current.shortcuts,
            sizing,
            moduleUrl: moduleUrlAtConnect,
            styles: stylesAtConnect,
            props: propsRef.current,
            theme: resolveActiveTheme(themeRef.current),
            themeVariables: collectChakraThemeVariables(),
            extensionId: view.extensionId,
          });
          if (iframeRef.current !== iframe) return;
          initializedRef.current = true;
          await remote.keyboardUpdate?.(keyboardRef.current.shortcuts);
          onReadyRef.current?.();
        })
        .catch((error) => {
          if (iframeRef.current !== iframe) return;
          onErrorRef.current?.(normalizeRuntimeError(error));
        });
    };

    connect();

    // Intentionally no connection.close() in cleanup. The iframe runtime handshakes once
    // at iframe load and binds to that connection ID. Closing during React StrictMode's
    // dev-only cleanup would leave the live iframe with no host listener.
    return removeLoadListener;
  }, [frameEpoch, sizing, view.extensionId, view.webview.runtimeUrl, view.webview.moduleUrl, view.webview.styles]);

  useEffect(() => {
    if (initializedRef.current) remoteRef.current?.keyboardUpdate?.(keyboardShortcuts);
  }, [keyboardShortcuts]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: replacing the browsing context replaces the focus listener.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const restoreFocus = () => remoteRef.current?.restoreFocus?.();
    iframe.addEventListener("focus", restoreFocus);
    return () => iframe.removeEventListener("focus", restoreFocus);
  }, [frameEpoch]);

  // Re-renders may hand the frame a fresh publisher (renderers rebuild their
  // capability context per render); route it to the live connection.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a replacement browsing context releases the old guest's ownership.
  useEffect(() => {
    const remote = remoteRef.current;
    if (remote) hostEvents?.bind((message) => remote.hostEvent?.(message));
    // Register cleanup before the asynchronous handshake completes. A stable
    // publisher does not rerun this effect when the remote becomes available.
    return () => hostEvents?.unbind();
  }, [hostEvents, frameEpoch]);

  useEffect(() => {
    if (!initializedRef.current) return;
    remoteRef.current?.propsUpdate({ props: createWebviewHostProps(extensionProps) });
  }, [extensionProps]);

  useEffect(() => {
    if (!initializedRef.current) return;
    remoteRef.current?.themeUpdate({
      theme: resolveActiveTheme(theme),
      variables: collectChakraThemeVariables(),
    });
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof MutationObserver === "undefined") return;

    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        if (!initializedRef.current) return;
        remoteRef.current?.themeUpdate({
          theme: resolveActiveTheme(themeRef.current),
          variables: collectChakraThemeVariables(),
        });
      });
    };

    const observer = new MutationObserver(schedule);
    const options = { attributeFilter: ["class", "data-color-mode", "data-theme", "style"], attributes: true };
    observer.observe(document.documentElement, options);
    observer.observe(document.body, options);

    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      style={{
        ...frameShellStyle,
        width: sizing === "content-width" ? contentWidth : "100%",
        height: sizing === "content-height" ? contentHeight : "100%",
      }}
    >
      <iframe
        // A new runtime or module needs its own browsing context and bridge handshake.
        key={`${frameEpoch}\n${view.webview.runtimeUrl}\n${view.webview.moduleUrl}`}
        ref={iframeRef}
        title={title ?? view.label}
        allow={extensionIframeAllow(view.webview.capabilities)}
        sandbox={EXTENSION_IFRAME_SANDBOX}
        // Match the host theme so the empty/loading iframe paints the right canvas
        // instead of flashing the default light background while the guest connects.
        style={{ ...iframeStyle, colorScheme: theme }}
        onError={() => {
          onErrorRef.current?.({ message: `Failed to load extension runtime at ${view.webview.runtimeUrl}` });
        }}
      />
    </div>
  );
};
