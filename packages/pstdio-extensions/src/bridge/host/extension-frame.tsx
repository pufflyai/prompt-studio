import { type CSSProperties, useEffect, useRef } from "react";
import { host } from "rimless";
import type {
  ExtensionViewDescriptor,
  HostCapabilityRegistry,
  HostCapabilityRequest,
  ThemePreference,
} from "../contract";
import { collectChakraThemeVariables, resolveActiveTheme } from "./theme";

export interface ExtensionFrameProps {
  view: ExtensionViewDescriptor;
  props: unknown;
  theme: ThemePreference;
  capabilities?: HostCapabilityRegistry;
  onReady?: () => void;
  onError?: (error: { message: string; stack?: string }) => void;
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

const iframeSandbox = "allow-scripts allow-same-origin allow-forms allow-popups";

export const ExtensionFrame = (props: ExtensionFrameProps) => {
  const { view, props: extensionProps, theme, capabilities, onReady, onError, title } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const remoteRef = useRef<GuestRemote | null>(null);
  const initializedRef = useRef(false);
  const connectedKeyRef = useRef<string | null>(null);
  const propsRef = useRef(extensionProps);
  const themeRef = useRef(theme);
  const capabilitiesRef = useRef(capabilities);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);

  propsRef.current = extensionProps;
  themeRef.current = theme;
  capabilitiesRef.current = capabilities;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;

  // Connect once per iframe (keyed by moduleUrl). React StrictMode dev double-mount and
  // parent re-renders with unstable prop references (e.g. `webview.styles` rebuilt by
  // `.map`) would otherwise tear down the live rimless connection while the iframe keeps
  // its state — leaving guest→host RPCs with no listener and hanging forever.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (connectedKeyRef.current === view.webview.moduleUrl) return;
    connectedKeyRef.current = view.webview.moduleUrl;

    initializedRef.current = false;
    remoteRef.current = null;
    // Snapshot styles at connect time so subsequent parent re-renders that produce a
    // new array reference don't affect what we send in init.
    const stylesAtConnect = view.webview.styles;
    const moduleUrlAtConnect = view.webview.moduleUrl;

    const hostApi = {
      ready: () => {
        // no-op; init fires from host.connect().then() below.
      },
      runtimeError: (payload: { message: string; stack?: string }) => {
        onErrorRef.current?.(payload);
      },
      call: async (request: HostCapabilityRequest) => {
        const handler = capabilitiesRef.current?.[request.method];
        if (!handler) throw new Error(`Unknown host capability: ${request.method}`);
        return await handler(request.params);
      },
    };

    void host.connect(iframe, hostApi).then(async (conn) => {
      const remote = conn.remote as unknown as GuestRemote;
      remoteRef.current = remote;

      try {
        await remote.init({
          moduleUrl: moduleUrlAtConnect,
          styles: stylesAtConnect,
          props: propsRef.current,
          theme: resolveActiveTheme(themeRef.current),
          themeVariables: collectChakraThemeVariables(),
        });
        initializedRef.current = true;
        onReadyRef.current?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onErrorRef.current?.({ message: err.message, stack: err.stack });
      }
    });

    // Intentionally NO connection.close() in cleanup. Rimless connection IDs are minted
    // at handshake time. The iframe's guest.connect runs ONCE at iframe load and binds to
    // the connectionID it negotiated. If the host closes that connection and runs a fresh
    // host.connect (e.g. due to React StrictMode dev double-mount), it gets a NEW
    // connectionID — and inbound RPC_REQUEST from the iframe is silently filtered out
    // (rimless: "connectionID !== o → return"). The connection lives as long as the iframe
    // DOM does; both are GC'd when the component is truly unmounted.
    return () => {
      // No-op. We deliberately keep the live connection.
    };
  }, [view.webview.moduleUrl, view.webview.styles]);

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
      src={view.webview.runtimeUrl}
      sandbox={iframeSandbox}
      style={iframeStyle}
    />
  );
};
