export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' ws: wss:",
  "worker-src 'self' blob:",
].join("; ");

export const createSecureWindowOptions = (preload: string, partition: string) => ({
  width: 1200,
  height: 800,
  minWidth: 720,
  minHeight: 520,
  show: false,
  webPreferences: {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: true,
    webviewTag: false,
    preload,
    partition,
  },
});

export const isAllowedExternalUrl = (value: string) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443")
    );
  } catch {
    return false;
  }
};

type NavigationPolicy = {
  lifecycleUrl: string;
  runtimeOrigin: string | null;
};

const isLifecycleDocument = (value: URL, lifecycleUrl: string) => {
  const target = new URL(value.href);
  const lifecycle = new URL(lifecycleUrl);
  target.hash = "";
  target.search = "";
  lifecycle.hash = "";
  lifecycle.search = "";
  return target.href === lifecycle.href;
};

export const decideNavigation = (value: string, policy: NavigationPolicy): "allow" | "external" | "deny" => {
  try {
    const url = new URL(value);
    if (isLifecycleDocument(url, policy.lifecycleUrl)) return "allow";
    if (policy.runtimeOrigin && url.origin === policy.runtimeOrigin) return "allow";
    return isAllowedExternalUrl(value) ? "external" : "deny";
  } catch {
    return "deny";
  }
};
