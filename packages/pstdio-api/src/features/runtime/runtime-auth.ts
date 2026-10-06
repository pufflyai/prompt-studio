import { randomBytes, timingSafeEqual } from "node:crypto";

export const RUNTIME_AUTH_COOKIE = "pstdio_runtime_session";

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

const cookieToken = (request: Request, cookieName: string) => {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;

  for (const pair of cookie.split(";")) {
    const [name, ...parts] = pair.trim().split("=");
    if (name === cookieName) return decodeURIComponent(parts.join("="));
  }
  return undefined;
};

const randomSecret = () => randomBytes(32).toString("base64url");

const runtimeSessionCookie = (secret: string) =>
  `${RUNTIME_AUTH_COOKIE}=${encodeURIComponent(secret)}; Path=/; HttpOnly; SameSite=Strict`;

// The browser cookie has its own secret, never the runtime token, so a cookie sent to another
// local server grants no bearer access (ADR 0054). Only bearer holders can give a browser this
// cookie: directly, or through a single-use login code that the browser redeems.
export const createBrowserSessions = (now = Date.now) => {
  const secret = randomSecret();
  const loginCodes = new Map<string, number>();

  return {
    cookie: () => runtimeSessionCookie(secret),
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
      return expiresAt !== undefined && expiresAt > now();
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
  if (isRuntimeBearerAuthorized(request, security)) return true;

  const expectedOrigin = runtimeOrigin(security);
  if (!expectedOrigin || new URL(request.url).origin !== expectedOrigin) return false;
  return security.browserSessions?.matches(cookieToken(request, RUNTIME_AUTH_COOKIE)) ?? false;
};
