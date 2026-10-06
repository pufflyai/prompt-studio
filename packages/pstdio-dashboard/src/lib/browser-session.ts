import {
  BROWSER_LOGIN_FRAGMENT_PARAM,
  RUNTIME_WEBSOCKET_PROTOCOL,
  WEBSOCKET_CREDENTIAL_PROTOCOL_PREFIX,
} from "pstdio-api-contracts/runtime-auth";

const STORAGE_KEY = "pstdio.browserSession";

// The browser scopes localStorage to the exact origin, port included, and never sends it on its
// own. So other local servers never see the secret, and two runtimes keep separate sessions
// (ADR 0057).
export const readBrowserSession = () => globalThis.localStorage?.getItem(STORAGE_KEY) ?? undefined;

export const storeBrowserSession = (secret: string) => globalThis.localStorage.setItem(STORAGE_KEY, secret);

export const takeBrowserLoginCode = (hash: string) => {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const code = params.get(BROWSER_LOGIN_FRAGMENT_PARAM);
  params.delete(BROWSER_LOGIN_FRAGMENT_PARAM);
  const rest = params.toString();
  return { code, hash: rest ? `#${rest}` : "" };
};

// Browsers cannot set headers on a WebSocket. The server selects the first protocol, so the
// secret goes second and is never echoed back.
export const browserSessionWebSocketProtocols = (secret: string | undefined) =>
  secret ? [RUNTIME_WEBSOCKET_PROTOCOL, `${WEBSOCKET_CREDENTIAL_PROTOCOL_PREFIX}${secret}`] : undefined;
