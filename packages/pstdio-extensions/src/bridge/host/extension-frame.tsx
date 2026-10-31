import type {
  WebviewHostProps,
  WebviewKeyboardShortcut,
  WebviewKeyboardShortcutRequest,
} from "pstdio-api-contracts/extension-kernel";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
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
import { capabilityReply } from "./capability-reply";
import { dispatchFramePointerEvent } from "./frame-pointer-events";
import type { HostEventPublisher } from "./host-event-publisher";
import { extensionIframeAllow } from "./iframe-permissions";
import { collectChakraThemeVariables, resolveActiveTheme } from "./theme";
import { useFrameTheme } from "./use-frame-theme";
import { useWebviewOverlays } from "./use-webview-overlays";
import type { WebviewOverlayPresentation } from "./webview-overlays";

export interface ExtensionFrameProps {
  renderOverlay?: (presentation: WebviewOverlayPresentation) => ReactNode;
  keyboardShortcuts?: readonly WebviewKeyboardShortcut[];
  onShortcut?: (request: WebviewKeyboardShortcutRequest) => void | Promise<void>;
  sizing?: "content-width" | "content-height";
  view: ExtensionViewDescriptor;
  props: Partial<WebviewHostProps> & Record<string, unknown>;
  theme: ThemePreference;
  /** Theme element owned by this view's workbench. Defaults to the document. */
  themeRoot?: () => HTMLElement | null;
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
    renderOverlay,
  } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const remoteRef = useRef<GuestRemote | null>(null);
  const initializedRef = useRef(false);
  // The connection belongs to one browsing context. Navigation keeps the iframe's
  // WindowProxy, so a different contentWindow means the runtime document is gone.
  const connectedWindowRef = useRef<Window | null>(null);
  const propsRef = useRef(createWebviewHostProps(extensionProps));
  const themeRef = useRef(theme);
  const themeRootRef = useRef(props.themeRoot);
  themeRootRef.current = props.themeRoot;
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
  const overlay = useWebviewOverlays(
    iframeRef,
    `${frameEpoch}\n${view.webview.runtimeUrl}\n${view.webview.moduleUrl}`,
    renderOverlay,
  );

  propsRef.current = createWebviewHostProps(extensionProps);
  themeRef.current = theme;
  capabilitiesRef.current = { ...capabilities, ...overlay.capabilities };
  onKeyboardEventRef.current = onKeyboardEvent;
  keyboardRef.current = { shortcuts: keyboardShortcuts, onShortcut };
  hostEventsRef.current = hostEvents;
  declaredCapabilitiesRef.current = view.webview.capabilities;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;
  onDiagnosticsRef.current = onDiagnostics;

  // Connect once per browsing context. React StrictMode dev double-mount and parent
  // re-renders with unstable prop references (e.g. `webview.styles` rebuilt by `.map`)
  // would otherwise tear down the live connection while the iframe keeps its state,
  // leaving guest-to-host RPCs with no listener.
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

    if (iframe.contentWindow === connectedWindowRef.current) return removeLoadListener;
    connectedWindowRef.current = iframe.contentWindow;

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
        dispatchFramePointerEvent(iframe, event);
      },
      contentHeightChanged: (height: number) => {
        if (sizing === "content-height" && Number.isFinite(height) && height >= 0) setContentHeight(height);
      },
      contentWidthChanged: (width: number) => {
        if (sizing === "content-width" && Number.isFinite(width) && width >= 0) setContentWidth(width);
      },
      dispatchKeyboardEvent: async (event: import("pstdio-api-contracts").WebviewKeyboardEventParams) => {
        if (onKeyboardEventRef.current) return onKeyboardEventRef.current(event);
        document.dispatchEvent(new KeyboardEvent("keydown", { ...event, bubbles: true, cancelable: true }));
      },
      ready: () => {
        // no-op; init fires from host.connect().then() below.
      },
      runtimeError: (payload: { message: string; stack?: string }) => {
        onErrorRef.current?.(payload);
      },
      call: async (request: HostCapabilityRequest) => {
        return await capabilityReply(() => {
          if (iframeRef.current !== iframe || !iframe.isConnected)
            throw new Error("Extension view is no longer mounted.");
          return createCapabilityGate().call(request);
        });
      },
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
            theme: resolveActiveTheme(themeRef.current, themeRootRef.current?.()),
            themeVariables: collectChakraThemeVariables(themeRootRef.current?.()),
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

  useFrameTheme({ theme, themeRoot: themeRootRef, initialized: initializedRef, remote: remoteRef });

  return (
    <div
      style={{
        ...frameShellStyle,
        width: sizing === "content-width" ? contentWidth : "100%",
        height: sizing === "content-height" ? contentHeight : "100%",
      }}
    >
      {overlay.content}
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
