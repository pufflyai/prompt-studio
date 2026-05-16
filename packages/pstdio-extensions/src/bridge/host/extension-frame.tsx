import { type CSSProperties, useEffect, useRef } from "react";
import { host } from "rimless";
import type {
  ExtensionViewDescriptor,
  HostCapabilityRegistry,
  HostCapabilityRequest,
  ThemePreference,
  WebviewCapabilityDiagnostic,
} from "../contract";
import { createHostCapabilityGate } from "../contract";
import { normalizeRuntimeError } from "../normalize-error";
import { collectChakraThemeVariables, resolveActiveTheme } from "./theme";

export interface ExtensionFrameProps {
  view: ExtensionViewDescriptor;
  props: unknown;
  theme: ThemePreference;
  capabilities?: HostCapabilityRegistry;
  onReady?: () => void;
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
  }) => Promise<void>;
  themeUpdate: (message: { theme: ThemePreference; variables: Record<string, string> }) => void;
  propsUpdate: (message: { props: unknown }) => void;
};

const iframeStyle: CSSProperties = {
  border: 0,
  display: "block",
  flex: "1 1 0%",
  height: "100%",
  minHeight: 0,
  width: "100%",
};

export const EXTENSION_IFRAME_SANDBOX = "allow-scripts allow-forms allow-popups";

export const ExtensionFrame = (props: ExtensionFrameProps) => {
  const { view, props: extensionProps, theme, capabilities, onReady, onError, onDiagnostics, title } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const remoteRef = useRef<GuestRemote | null>(null);
  const initializedRef = useRef(false);
  const connectedKeyRef = useRef<string | null>(null);
  const propsRef = useRef(extensionProps);
  const themeRef = useRef(theme);
  const capabilitiesRef = useRef(capabilities);
  const declaredCapabilitiesRef = useRef(view.webview.capabilities);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onDiagnosticsRef = useRef(onDiagnostics);

  propsRef.current = extensionProps;
  themeRef.current = theme;
  capabilitiesRef.current = capabilities;
  declaredCapabilitiesRef.current = view.webview.capabilities;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;
  onDiagnosticsRef.current = onDiagnostics;

  // Connect once per iframe (keyed by runtime/module URL). React StrictMode dev double-mount and
  // parent re-renders with unstable prop references (e.g. `webview.styles` rebuilt by
  // `.map`) would otherwise tear down the live connection while the iframe keeps its
  // state, leaving guest-to-host RPCs with no listener.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const connectedKey = `${view.webview.runtimeUrl}\n${view.webview.moduleUrl}`;
    if (connectedKeyRef.current === connectedKey) return;
    connectedKeyRef.current = connectedKey;

    initializedRef.current = false;
    remoteRef.current = null;
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

    const connection = host.connect(iframe, hostApi);
    // A sandboxed iframe without allow-same-origin posts messages with origin "null".
    // Leaving the iframe src attribute empty lets rimless validate the guest by
    // contentWindow identity while still loading the API-owned runtime document.
    iframe.contentWindow?.location.replace(view.webview.runtimeUrl);

    connection
      .then(async (conn) => {
        const remote = conn.remote as GuestRemote;
        remoteRef.current = remote;

        await remote.init({
          moduleUrl: moduleUrlAtConnect,
          styles: stylesAtConnect,
          props: propsRef.current,
          theme: resolveActiveTheme(themeRef.current),
          themeVariables: collectChakraThemeVariables(),
        });
        initializedRef.current = true;
        onReadyRef.current?.();
      })
      .catch((error) => {
        onErrorRef.current?.(normalizeRuntimeError(error));
      });

    // Intentionally no connection.close() in cleanup. The iframe runtime handshakes once
    // at iframe load and binds to that connection ID. Closing during React StrictMode's
    // dev-only cleanup would leave the live iframe with no host listener.
    return () => {
      // No-op. We deliberately keep the live connection.
    };
  }, [view.webview.runtimeUrl, view.webview.moduleUrl, view.webview.styles]);

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
    const options = { attributeFilter: ["class", "data-theme", "style"], attributes: true };
    observer.observe(document.documentElement, options);
    observer.observe(document.body, options);

    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title={title ?? view.label}
      sandbox={EXTENSION_IFRAME_SANDBOX}
      style={iframeStyle}
      onError={() =>
        onErrorRef.current?.({
          message: `Failed to load extension runtime at ${view.webview.runtimeUrl}`,
        })
      }
    />
  );
};
