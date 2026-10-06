import { type CSSProperties, useEffect, useRef, useState } from "react";
import { host } from "rimless";
import type {
  ExtensionViewDescriptor,
  HostCapabilityRegistry,
  HostCapabilityRequest,
  HostEventMessage,
  ThemePreference,
  WebviewCapabilityDiagnostic,
} from "../contract";
import { createHostCapabilityGate } from "../contract";
import { normalizeRuntimeError } from "../normalize-error";
import type { HostEventPublisher } from "./host-event-publisher";
import { extensionIframeAllow } from "./iframe-permissions";
import { collectChakraThemeVariables, resolveActiveTheme } from "./theme";

export interface ExtensionFrameProps {
  view: ExtensionViewDescriptor;
  props: unknown;
  theme: ThemePreference;
  capabilities?: HostCapabilityRegistry;
  /** Publisher whose emitted events are forwarded into the guest once connected. */
  hostEvents?: HostEventPublisher;
  onReady?: () => void;
  /** Reports a load or runtime failure. The frame draws no error UI; the caller shows the failure once. */
  onError?: (error: { message: string; stack?: string }) => void;
  onDiagnostics?: (diagnostics: WebviewCapabilityDiagnostic[]) => void;
  title?: string;
}

type GuestRemote = {
  init: (message: {
    moduleUrl: string;
    styles: string[];
    props: unknown;
    theme: ThemePreference;
    themeVariables: Record<string, string>;
    extensionId: string;
  }) => Promise<void>;
  themeUpdate: (message: { theme: ThemePreference; variables: Record<string, string> }) => void;
  propsUpdate: (message: { props: unknown }) => void;
  hostEvent?: (message: HostEventMessage) => void;
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

export const ExtensionFrame = (props: ExtensionFrameProps) => {
  const {
    view,
    props: extensionProps,
    theme,
    capabilities,
    hostEvents,
    onReady,
    onError,
    onDiagnostics,
    title,
  } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const remoteRef = useRef<GuestRemote | null>(null);
  const initializedRef = useRef(false);
  // The connection belongs to one browsing context. Navigation keeps the iframe's
  // WindowProxy, so a different contentWindow means the runtime document is gone.
  const connectedWindowRef = useRef<Window | null>(null);
  const propsRef = useRef(extensionProps);
  const themeRef = useRef(theme);
  const capabilitiesRef = useRef(capabilities);
  const hostEventsRef = useRef(hostEvents);
  const declaredCapabilitiesRef = useRef(view.webview.capabilities);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onDiagnosticsRef = useRef(onDiagnostics);
  // Bumped when the browser reloads the iframe (e.g. a DOM reparent while the Side
  // Panel floats). The bump remounts a fresh iframe so a single clean connection
  // owns the new browsing context.
  const [frameEpoch, setFrameEpoch] = useState(0);

  propsRef.current = extensionProps;
  themeRef.current = theme;
  capabilitiesRef.current = capabilities;
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
      ready: () => {
        // no-op; init fires from host.connect().then() below.
      },
      runtimeError: (payload: { message: string; stack?: string }) => {
        onErrorRef.current?.(payload);
      },
      call: async (request: HostCapabilityRequest) => {
        return await createCapabilityGate().call(request);
      },
    };

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
            moduleUrl: moduleUrlAtConnect,
            styles: stylesAtConnect,
            props: propsRef.current,
            theme: resolveActiveTheme(themeRef.current),
            themeVariables: collectChakraThemeVariables(),
            extensionId: view.extensionId,
          });
          if (iframeRef.current !== iframe) return;
          initializedRef.current = true;
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
  }, [frameEpoch, view.extensionId, view.webview.runtimeUrl, view.webview.moduleUrl, view.webview.styles]);

  // Re-renders may hand the frame a fresh publisher (renderers rebuild their
  // capability context per render); route it to the live connection.
  useEffect(() => {
    const remote = remoteRef.current;
    if (!remote || !hostEvents) return;
    hostEvents.bind((message) => remote.hostEvent?.(message));
    // Release the sink so a replaced publisher stops referencing this remote
    // and returns to buffering.
    return () => hostEvents.unbind();
  }, [hostEvents]);

  useEffect(() => {
    if (!initializedRef.current) return;
    remoteRef.current?.propsUpdate({ props: extensionProps });
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
    <div style={frameShellStyle}>
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
