import type { ReportFailure } from "pstdio-service-telemetry";
import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { deviceHttp } from "./device-http";
import type { createManagerAuthentication } from "./manager-authentication";
import { nativeLogin } from "./native-login";
import { EnvironmentAccessDenied, EnvironmentAccessFailure } from "./renewal-errors";

type Authentication = ReturnType<typeof createManagerAuthentication>;
const renewal = z.strictObject({ workbenchId: identitySchema });
const json = (body: unknown, status = 200, headers?: ConstructorParameters<typeof Headers>[0]) =>
  Response.json(body, {
    status,
    headers: { ...Object.fromEntries(new Headers(headers)), "cache-control": "no-store" },
  });
const unauthorized = () => json({ error: "Authentication unavailable" }, 401, { "www-authenticate": "Bearer" });

type RenewalLog = (event: { event: "environment_access.failed"; category: "database" | "signing" | "service" }) => void;

const renewAccess = async (auth: Authentication, request: Request, log: RenewalLog, report: ReportFailure) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { allow: "POST" });
  const token = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return unauthorized();
  let workbenchId: string;
  try {
    workbenchId = renewal.parse(await request.json()).workbenchId;
  } catch {
    return unauthorized();
  }
  try {
    return json(await auth.renew(token, workbenchId));
  } catch (error) {
    if (error instanceof EnvironmentAccessDenied) return unauthorized();
    const category = error instanceof EnvironmentAccessFailure ? error.category : "service";
    report(`renewal_${category}_failed`);
    log({
      event: "environment_access.failed",
      category,
    });
    return json({ error: "Environment access service unavailable" }, 503);
  }
};

const betterAuth = async (auth: Authentication, request: Request, report: ReportFailure) => {
  const response = await auth.handler(request);
  if (response.status < 500) return response;
  await response.body?.cancel().catch(() => {});
  if (!request.signal.aborted) report("request_exception");
  return json({ error: "Account manager unavailable" }, 503);
};

export const createManagerHandler = (
  auth: Authentication,
  origin: string,
  log: RenewalLog = (event) => console.error(JSON.stringify(event)),
  report: ReportFailure = () => {},
) => {
  const canonicalOrigin = new URL(origin).origin;
  return async (request: Request) => {
    try {
      const path = new URL(request.url).pathname;
      if (path.startsWith("/api/auth/")) return await betterAuth(auth, request, report);
      if (["/v1/native-login", "/v1/native-callback"].includes(path))
        return await nativeLogin(auth, canonicalOrigin, request);
      const deviceResponse = await deviceHttp(auth, canonicalOrigin, request);
      if (deviceResponse) return deviceResponse;
      if (path === "/health") return json({ ok: true });
      if (path === "/v1/environment-access") return await renewAccess(auth, request, log, report);
      return json({ error: "Not found" }, 404);
    } catch {
      if (!request.signal.aborted) report("request_exception");
      return json({ error: "Account manager unavailable" }, 503);
    }
  };
};
