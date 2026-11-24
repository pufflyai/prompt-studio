import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { INetworkModule } from "@azure/msal-node";
import { generateKeyPair, SignJWT } from "jose";
import { microsoftIdentity } from "./microsoft-client";

const dispose: (() => unknown | Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of dispose.splice(0).reverse()) await cleanup();
});

test("Microsoft device sign-in persists a private MSAL cache and renews silently across client restarts", async () => {
  const home = await mkdtemp(join(tmpdir(), "microsoft-signin-"));
  dispose.push(() => rm(home, { recursive: true, force: true }));
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const objectId = "22222222-2222-4222-8222-222222222222";
  const clientId = "33333333-3333-4333-8333-333333333333";
  const authority = `https://login.microsoftonline.com/${tenantId}`;
  const keys = await generateKeyPair("RS256");
  const grants: URLSearchParams[] = [];
  let denyRefresh = false;
  const identity = () =>
    new SignJWT({ tid: tenantId, oid: objectId, ver: "2.0", name: "Colleague" })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(`${authority}/v2.0`)
      .setAudience(clientId)
      .setSubject("pairwise-subject")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keys.privateKey);
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/v1/login/microsoft") return Response.json({ tenantId, clientId });
      const target = url.searchParams.get("target") ?? "";
      if (target.includes("discovery/instance"))
        return Response.json({
          tenant_discovery_endpoint: `${authority}/v2.0/.well-known/openid-configuration`,
          metadata: [
            {
              preferred_network: "login.microsoftonline.com",
              preferred_cache: "login.microsoftonline.com",
              aliases: ["login.microsoftonline.com"],
            },
          ],
        });
      if (target.includes("openid-configuration"))
        return Response.json({
          authorization_endpoint: `${authority}/oauth2/v2.0/authorize`,
          token_endpoint: `${authority}/oauth2/v2.0/token`,
          end_session_endpoint: `${authority}/oauth2/v2.0/logout`,
          issuer: `${authority}/v2.0`,
          jwks_uri: `${authority}/discovery/v2.0/keys`,
        });
      if (target.includes("devicecode"))
        return Response.json({
          device_code: "private-device-code",
          user_code: "ABCD",
          verification_uri: "https://microsoft.com/devicelogin",
          expires_in: 900,
          interval: 0,
          message: "Enter ABCD at Microsoft sign-in.",
        });
      const form = new URLSearchParams(await request.text());
      grants.push(form);
      if (denyRefresh)
        return Response.json({ error: "invalid_grant", error_description: "private-error-token" }, { status: 400 });
      return Response.json({
        token_type: "Bearer",
        scope: "openid profile offline_access",
        expires_in: 3600,
        access_token: "private-access-token",
        refresh_token: "private-refresh-token",
        id_token: await identity(),
        client_info: Buffer.from(JSON.stringify({ uid: objectId, utid: tenantId })).toString("base64url"),
      });
    },
  });
  dispose.push(() => server.stop(true));
  const send = async <T>(
    url: string,
    method: string,
    options?: { headers?: Record<string, string>; body?: string },
  ) => {
    expect(new URL(url).hostname).toBe("login.microsoftonline.com");
    const result = await fetch(`${server.url}protocol?target=${encodeURIComponent(url)}`, {
      method,
      headers: options?.headers,
      body: options?.body,
    });
    return { headers: Object.fromEntries(result.headers), status: result.status, body: (await result.json()) as T };
  };
  const networkClient: INetworkModule = {
    sendGetRequestAsync: <T>(url: string, options?: { headers?: Record<string, string> }) =>
      send<T>(url, "GET", options),
    sendPostRequestAsync: <T>(url: string, options?: { headers?: Record<string, string>; body?: string }) =>
      send<T>(url, "POST", options),
  };
  const announced: string[] = [];
  const options = { home, broker: server.url.origin, networkClient, announce: (text: string) => announced.push(text) };
  expect(await microsoftIdentity({ ...options, login: true })).toContain(".");
  expect(await microsoftIdentity(options)).toContain(".");
  expect(grants.map((g) => g.get("grant_type"))).toEqual(["device_code", "refresh_token"]);
  expect(grants.every((g) => !g.get("scope")?.toLowerCase().includes("user.read"))).toBe(true);
  expect(announced).toEqual(["Enter ABCD at Microsoft sign-in."]);
  const cache = join(home, "cloud-access/microsoft", `${tenantId}-${clientId}.json`);
  expect((await stat(cache)).mode & 0o777).toBe(0o600);
  expect((await stat(join(home, "cloud-access/microsoft"))).mode & 0o777).toBe(0o700);
  expect(await readFile(cache, "utf8")).toContain("private-refresh-token");
  denyRefresh = true;
  await expect(microsoftIdentity(options)).rejects.toThrow("Microsoft sign-in needs attention");
  expect(announced.join(" ")).not.toContain("private-");
});
