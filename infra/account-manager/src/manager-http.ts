import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { createManagerAuthentication } from "./manager-authentication";

type Authentication = ReturnType<typeof createManagerAuthentication>;
const renewal = z.strictObject({ workbenchId: identitySchema });
const json = (body: unknown, status = 200, headers?: ConstructorParameters<typeof Headers>[0]) =>
  Response.json(body, {
    status,
    headers: { ...Object.fromEntries(new Headers(headers)), "cache-control": "no-store" },
  });
const unauthorized = () => json({ error: "Authentication unavailable" }, 401, { "www-authenticate": "Bearer" });

const renewAccess = async (auth: Authentication, request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { allow: "POST" });
  try {
    const token = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(request.headers.get("authorization") ?? "")?.[1];
    if (!token) return unauthorized();
    const { workbenchId } = renewal.parse(await request.json());
    return json(await auth.renew(token, workbenchId));
  } catch {
    return unauthorized();
  }
};

const manageEnvironments = async (
  auth: Authentication,
  origin: string,
  request: Request,
  management: RegExpExecArray,
) => {
  if (!["GET", "POST"].includes(request.method) || (management[2] && request.method !== "POST"))
    return json({ error: "Method not allowed" }, 405, { allow: management[2] ? "POST" : "GET, POST" });
  if (request.method === "POST" && request.headers.get("origin") !== origin)
    return json({ error: "Origin denied" }, 403);
  try {
    const owner = auth.forSession(request.headers, decodeURIComponent(management[1]));
    if (request.method === "GET") return json(await owner.environments());
    const input = await request.json();
    if (management[2] === "replace") return json(await owner.replace(input), 201);
    if (management[2] === "revoke") {
      await owner.revoke(input);
      return json({ ok: true });
    }
    return json(await owner.register(input), 201);
  } catch {
    return unauthorized();
  }
};

export const createManagerHandler = (auth: Authentication, origin: string) => {
  const canonicalOrigin = new URL(origin).origin;
  return async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/auth/")) return auth.handler(request);
    if (path === "/health") return json({ ok: true });
    if (path === "/v1/environment-access") return renewAccess(auth, request);
    const management = /^\/v1\/accounts\/([^/]+)\/environments(?:\/(replace|revoke))?$/.exec(path);
    if (management) return manageEnvironments(auth, canonicalOrigin, request, management);
    return json({ error: "Not found" }, 404);
  };
};
