import { randomBytes, timingSafeEqual } from "node:crypto";
import { WEBSOCKET_CREDENTIAL_PROTOCOL_PREFIX } from "pstdio-api-contracts/runtime-auth";

const LOGIN_CODE_TTL_MS = 60_000;

export type BrowserSessions = ReturnType<typeof createBrowserSessions>;

export type RuntimeSecurity = {
  token: string;
  origin?: () => string | null;
  browserSessions?: BrowserSessions;
};

const tokenMatches = (candidate: string | undefined, expected: string) => {
  if (!candidate) return false;
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
};

const bearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization");
  if (!authorization || !/^bearer\s+/i.test(authorization)) return undefined;
  return authorization.replace(/^bearer\s+/i, "").trim();
};

const webSocketCredential = (request: Request) =>
  request.headers
    .get("sec-websocket-protocol")
    ?.split(",")
    .map((protocol) => protocol.trim())
    .find((protocol) => protocol.startsWith(WEBSOCKET_CREDENTIAL_PROTOCOL_PREFIX))
    ?.slice(WEBSOCKET_CREDENTIAL_PROTOCOL_PREFIX.length);

const requestCredential = (request: Request) => bearerToken(request) ?? webSocketCredential(request);

const randomSecret = () => randomBytes(32).toString("base64url");

// The browser session has its own secret, never the runtime token. The browser keeps it in
// per-origin storage and sends it as a header, so other servers on 127.0.0.1 never receive it
// (ADR 0057). Only bearer holders can sign a browser in, through a single-use login code.
export const createBrowserSessions = (now = Date.now) => {
  const secret = randomSecret();
  const loginCodes = new Map<string, number>();

  return {
    matches: (candidate: string | undefined) => tokenMatches(candidate, secret),
    createLoginCode: () => {
      for (const [code, expiresAt] of loginCodes) {
        if (expiresAt <= now()) loginCodes.delete(code);
      }
      const code = randomSecret();
      loginCodes.set(code, now() + LOGIN_CODE_TTL_MS);
      return code;
    },
    redeemLoginCode: (code: string) => {
      const expiresAt = loginCodes.get(code);
      loginCodes.delete(code);
      return expiresAt !== undefined && expiresAt > now() ? secret : null;
    },
  };
};

export const runtimeOrigin = (security: RuntimeSecurity) => security.origin?.() ?? null;

export const isRuntimeOriginAllowed = (request: Request, security: RuntimeSecurity) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === runtimeOrigin(security);
};

export const isRuntimeBearerAuthorized = (request: Request, security: RuntimeSecurity) =>
  tokenMatches(bearerToken(request), security.token);

export const isRuntimeRequestAuthorized = (request: Request, security: RuntimeSecurity) => {
  if (!isRuntimeOriginAllowed(request, security)) return false;
  const credential = requestCredential(request);
  if (tokenMatches(credential, security.token)) return true;
  return security.browserSessions?.matches(credential) ?? false;
};
