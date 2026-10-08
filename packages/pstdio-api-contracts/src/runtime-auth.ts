/** Fragment parameter that carries a single-use browser login code (ADR 0057). */
export const BROWSER_LOGIN_FRAGMENT_PARAM = "browser-login";

/** The subprotocol a runtime WebSocket selects. A browser offers it first. */
export const RUNTIME_WEBSOCKET_PROTOCOL = "pstdio";

/**
 * Browsers cannot set headers on a WebSocket, so a browser offers its credential as a second
 * subprotocol with this prefix (ADR 0057).
 */
export const WEBSOCKET_CREDENTIAL_PROTOCOL_PREFIX = "pstdio.bearer.";
