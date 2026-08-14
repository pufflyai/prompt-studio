import { timingSafeEqual } from "node:crypto";

export const RUNTIME_AUTH_COOKIE = "pstdio_runtime_session";
export const EXTENSION_WEBVIEW_AUTH_COOKIE = "pstdio_extension_webview_session";

export type RuntimeSecurity = {
  token: string;
  origin?: () => string | null;
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

const cookieToken = (request: Request, cookieName: string) => {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;

  for (const pair of cookie.split(";")) {
    const [name, ...parts] = pair.trim().split("=");
    if (name === cookieName) return decodeURIComponent(parts.join("="));
  }
  return undefined;
};

export const runtimeOrigin = (security: RuntimeSecurity) => security.origin?.() ?? null;

export const isRuntimeOriginAllowed = (request: Request, security: RuntimeSecurity) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === runtimeOrigin(security);
};

export const isRuntimeBearerAuthorized = (request: Request, security: RuntimeSecurity) =>
  tokenMatches(bearerToken(request), security.token);

export const isRuntimeRequestAuthorized = (
  request: Request,
  security: RuntimeSecurity,
  options: { allowOpaqueOrigin?: boolean } = {},
) => {
  const originAllowed =
    isRuntimeOriginAllowed(request, security) ||
    (options.allowOpaqueOrigin === true && request.headers.get("origin") === "null");
  if (!originAllowed) return false;
  if (isRuntimeBearerAuthorized(request, security)) return true;

  const expectedOrigin = runtimeOrigin(security);
  if (!expectedOrigin || new URL(request.url).origin !== expectedOrigin) return false;
  const cookieName = request.headers.get("origin") === "null" ? EXTENSION_WEBVIEW_AUTH_COOKIE : RUNTIME_AUTH_COOKIE;
  return tokenMatches(cookieToken(request, cookieName), security.token);
};

export const runtimeSessionCookie = (token: string) =>
  `${RUNTIME_AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict`;

export const extensionWebviewSessionCookie = (token: string) =>
  `${EXTENSION_WEBVIEW_AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/v1/extensions; HttpOnly; SameSite=None; Secure`;
