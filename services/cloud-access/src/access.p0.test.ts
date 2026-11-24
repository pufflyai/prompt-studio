import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRemoteJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createAccessService } from "./access";
import { parseConfig } from "./config";
import { createController } from "./controller";
import { createGrantStore } from "./grants";
import { createGoogleVerifier, createIdentityVerifier } from "./identity";
import { createStorageAccess } from "./storage-access";

const disposers: (() => unknown | Promise<unknown>)[] = [];
afterEach(async () => {
  for (const dispose of disposers.splice(0).reverse()) await dispose();
});

async function fixture(
  preview?: (id: string, deadline: string) => Promise<{ url: string; expiresAt: string }>,
  microsoft = false,
) {
  const root = await mkdtemp(join(tmpdir(), "cloud-access-"));
  disposers.push(() => rm(root, { recursive: true, force: true }));
  const keys = await generateKeyPair("RS256");
  const microsoftKeys = await generateKeyPair("RS256");
  const microsoftJwk = {
    ...(await exportJWK(microsoftKeys.publicKey)),
    kid: "microsoft-fixture",
    alg: "RS256",
    use: "sig",
  };
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: "google-fixture", alg: "RS256", use: "sig" };
  const requests: { method: string; path: string; body: Record<string, unknown> }[] = [];
  const issuedScopes = new Map<string, string[]>();
  const allowedWorkspaces = new Set<string>();
  const upstream = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      const publicKeys = ({ "/microsoft-jwks": [microsoftJwk], "/jwks": [jwk] } as Record<string, unknown[]>)[path];
      if (publicKeys) return Response.json({ keys: publicKeys });
      const workspace = path.match(/^\/v1\/workspaces\/([0-9a-f-]{36})$/);
      if (workspace && req.method === "GET")
        return Response.json({ id: workspace[1] }, { status: allowedWorkspaces.has(workspace[1]!) ? 200 : 403 });
      if (path.endsWith("/requests")) {
        const token = req.headers.get("authorization")?.slice(7) ?? "";
        // PocketCoder's agent-request API requires services:relay, not conversations:read.
        return Response.json(
          { accepted: true },
          { status: issuedScopes.get(token)?.includes("services:relay") ? 200 : 403 },
        );
      }
      expect(req.headers.get("authorization")).toBe("Bearer issuer-private");
      const body = req.method === "POST" ? await req.json() : {};
      requests.push({ method: req.method, path, body });
      if (path === "/v1/principals") return Response.json({ id: crypto.randomUUID() }, { status: 201 });
      if (req.method === "DELETE") return Response.json({ revoked: true });
      const token = `pkt_${crypto.randomUUID()}`;
      issuedScopes.set(token, body.scopes as string[]);
      return Response.json({ token, key: { id: crypto.randomUUID(), expires_at: body.expires_at } }, { status: 201 });
    },
  });
  disposers.push(() => upstream.stop(true));
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const objectId = "22222222-2222-4222-8222-222222222222";
  const clientId = "33333333-3333-4333-8333-333333333333";
  const config = parseConfig({
    ...(microsoft && { microsoft: { tenantId, clientId } }),
    controllerUrl: upstream.url.origin,
    audience: "https://access.example.test",
    humanAudience: "desktop-client",
    humans: [
      { subject: "alice", principalId: crypto.randomUUID() },
      ...(microsoft
        ? [{ provider: "microsoft", subject: `${tenantId}:${objectId}`, principalId: crypto.randomUUID() }]
        : []),
    ],
    launchers: ["launcher"],
    templates: ["remote-tests", "remote-tests-branch", "prompt-studio-preview", "prompt-studio-preview-branch"],
    settings: {
      templateName: "remote-tests",
      templateVersion: "1.0.0",
      testCommand: "bun test",
      timeoutMinutes: 60,
      storageBucket: "test-bucket",
      signerAccount: "signer@example.test",
    },
    manifests: {
      tests: { metadata: { name: "remote-tests" }, spec: { version: "1.0.0" } },
      preview: { metadata: { name: "prompt-studio-preview" }, spec: { version: "1.0.0" } },
    },
  });
  const googleKey = createRemoteJWKSet(new URL("/jwks", upstream.url));
  const verify = microsoft
    ? createIdentityVerifier(config, {
        google: googleKey,
        microsoft: createRemoteJWKSet(new URL("/microsoft-jwks", upstream.url)),
      })
    : createGoogleVerifier(config, googleKey);
  const controller = createController(config.controllerUrl, async () => "issuer-private");
  const store = await createGrantStore(root);
  const signedObjects: string[] = [];
  const storage = createStorageAccess({
    issuer: config.audience,
    key: crypto.getRandomValues(new Uint8Array(32)),
    sign: async (input) => {
      signedObjects.push(input.object);
      return `https://storage.googleapis.com/bucket/${input.object}`;
    },
  });
  const service = createAccessService({ config: () => config, verify, controller, store, storage, preview });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: service.fetch });
  disposers.push(() => server.stop(true));
  async function token(subject: string, claims: Record<string, unknown> = {}) {
    return new SignJWT({ email_verified: true, ...claims })
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
      .setIssuer("https://accounts.google.com")
      .setAudience(subject === "alice" ? "desktop-client" : config.audience)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(keys.privateKey);
  }
  async function call(path: string, identity: string, body?: unknown, method = "POST") {
    return fetch(new URL(path, server.url), {
      method,
      headers: { Authorization: `Bearer ${identity}`, "Content-Type": "application/json" },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  }
  const microsoftToken = (claims: Record<string, unknown> = {}) =>
    new SignJWT({
      tid: tenantId,
      oid: objectId,
      ver: "2.0",
      sub: "pairwise-subject",
      iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      aud: clientId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      ...claims,
    })
      .setProtectedHeader({ alg: "RS256", kid: microsoftJwk.kid })
      .sign(microsoftKeys.privateKey);
  return {
    microsoftToken,
    tenantId,
    objectId,
    clientId,
    root,
    config,
    controller,
    store,
    requests,
    token,
    call,
    verify,
    keys,
    controllerUrl: upstream.url.origin,
    signedObjects,
    allowedWorkspaces,
  };
}

test("approved people receive private role credentials and shared setup without choosing authority", async () => {
  const f = await fixture();
  const response = await f.call("/v1/session", await f.token("alice"), {});
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const session = await response.json();
  expect(session.settings.storageBucket).toBe("test-bucket");
  expect(session.credentials).toHaveLength(4);
  expect(
    session.credentials
      .filter((c: { connectionId: string }) => c.connectionId !== "cloud-storage")
      .every((c: { secret: string }) => c.secret.startsWith("pkt_")),
  ).toBe(true);
  expect(f.requests.every((r) => r.path.includes(f.config.humans[0]!.principalId))).toBe(true);
  expect(f.requests.every((r) => !(r.body.scopes as string[]).includes("admin"))).toBe(true);
  expect((await f.call("/v1/session", await f.token("alice"), { scopes: ["admin"] })).status).toBe(400);
  const runner = session.credentials.find((c: { connectionId: string }) => c.connectionId === "pocketcoder");
  const execution = await fetch(`${f.controllerUrl}/v1/workspaces/${crypto.randomUUID()}/requests`, {
    method: "POST",
    headers: { Authorization: `Bearer ${runner.secret}` },
  });
  expect(execution.status).toBe(200);
});

test("previews require controller workspace ownership and reject links beyond authorization", async () => {
  let called = false;
  const f = await fixture(async () => {
    called = true;
    return { url: "https://preview.example.test/", expiresAt: new Date(Date.now() + 7200_000).toISOString() };
  });
  f.config.previewHelper = "/private/operator-helper.ts";
  const id = crypto.randomUUID();
  const identity = await f.token("alice");
  expect((await f.call("/v1/preview", identity, { workspaceId: id })).status).toBe(502);
  expect(called).toBe(false);
  f.allowedWorkspaces.add(id);
  const result = await f.call("/v1/preview", identity, { workspaceId: id });
  expect(result.status).toBe(502);
  expect(await result.text()).not.toContain("preview.example.test");
});

test("revoking a run during preview attachment prevents link delivery without blocking revocation", async () => {
  let finish!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const f = await fixture(async () => {
    started();
    await waiting;
    return { url: "https://preview.example.test/", expiresAt: new Date(Date.now() + 30_000).toISOString() };
  });
  f.config.previewHelper = "/private/operator-helper.ts";
  const runId = crypto.randomUUID();
  const launcher = await f.token("launcher");
  await f.call("/v1/runs", launcher, {
    runId,
    subject: "vm",
    instance,
    deadline: new Date(Date.now() + 120_000).toISOString(),
  });
  const id = crypto.randomUUID();
  f.allowedWorkspaces.add(id);
  const pending = f.call("/v1/preview", await f.token("vm", { google: { compute_engine: instance } }), {
    runId,
    workspaceId: id,
  });
  await entered;
  expect((await f.call(`/v1/runs/${runId}`, launcher, undefined, "DELETE")).status).toBe(200);
  finish();
  expect((await pending).status).toBe(403);
});

test("signed Google identity checks reject wrong audience, issuer, expiry, signature and unknown users", async () => {
  const f = await fixture();
  const valid = await f.token("alice");
  const claims = JSON.parse(Buffer.from(valid.split(".")[1]!, "base64url").toString());
  for (const override of [
    { aud: "other" },
    { iss: "https://attacker.test" },
    { exp: 1 },
    { email_verified: false },
    { sub: "stranger" },
  ]) {
    const token = await new SignJWT({ ...claims, ...override })
      .setProtectedHeader({ alg: "RS256", kid: "google-fixture" })
      .sign(f.keys.privateKey);
    expect([401, 403]).toContain((await f.call("/v1/session", token, {})).status);
  }
  const other = await generateKeyPair("RS256");
  const forged = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "google-fixture" })
    .sign(other.privateKey);
  expect((await f.call("/v1/session", forged, {})).status).toBe(401);
  expect(f.requests).toHaveLength(0);
});

const instance = { project_id: "vm-project", project_number: 123, zone: "europe-west1-b", instance_id: "123456" };

test("only a trusted launcher can bind an instance to a run; renewal stays within its deadline", async () => {
  const f = await fixture();
  const deadline = new Date(Date.now() + 120_000).toISOString();
  const grant = { runId: crypto.randomUUID(), subject: "shared-vm-service-account", instance, deadline };
  expect((await f.call("/v1/runs", await f.token("alice"), grant)).status).toBe(403);
  expect((await f.call("/v1/runs", await f.token("launcher"), grant)).status).toBe(201);
  const vm = await f.token(grant.subject, { google: { compute_engine: instance } });
  const first = await f.call("/v1/session", vm, { runId: grant.runId });
  expect(first.status).toBe(200);
  const session = await first.json();
  expect(Date.parse(session.expiresAt)).toBeLessThanOrEqual(Date.parse(deadline));
  expect((await f.call("/v1/session", vm, { runId: grant.runId })).status).toBe(200);
  const wrongVm = await f.token(grant.subject, { google: { compute_engine: { ...instance, instance_id: "another" } } });
  expect((await f.call("/v1/session", wrongVm, { runId: grant.runId })).status).toBe(403);
  expect((await f.call("/v1/session", vm, {})).status).toBe(403);
  expect((await f.call("/v1/session", await f.token("other-vm"), { runId: grant.runId })).status).toBe(403);
  expect((await f.call("/v1/runs", await f.token("launcher"), grant)).status).toBe(409);
  const restored = await createGrantStore(f.root);
  expect((await restored.get(grant.runId))?.subject).toBe(grant.subject);
  expect((await f.call(`/v1/runs/${grant.runId}`, await f.token("alice"), undefined, "DELETE")).status).toBe(403);
  expect((await f.call(`/v1/runs/${grant.runId}`, await f.token("launcher"), undefined, "DELETE")).status).toBe(200);
  expect((await f.call("/v1/session", vm, { runId: grant.runId })).status).toBe(403);
  expect(f.requests.some((r) => r.method === "DELETE" && r.path.endsWith("/keys"))).toBe(true);
});

test("revocation prevents renewal even if controller revocation fails", async () => {
  const f = await fixture();
  const runId = crypto.randomUUID();
  await f.call("/v1/runs", await f.token("launcher"), {
    runId,
    subject: "vm",
    instance,
    deadline: new Date(Date.now() + 100_000).toISOString(),
  });
  f.controller.revoke = async () => {
    throw new Error("upstream leaked issuer-private");
  };
  const result = await f.call(`/v1/runs/${runId}`, await f.token("launcher"), undefined, "DELETE");
  expect(result.status).toBe(502);
  expect(await result.text()).not.toContain("issuer-private");
  expect(
    (await f.call("/v1/session", await f.token("vm", { google: { compute_engine: instance } }), { runId })).status,
  ).toBe(403);
});

test("a workload subject cannot become shared while an unbound grant exists, in either registration order", async () => {
  const f = await fixture();
  const launcher = await f.token("launcher");
  const base = { subject: "unbound-then-bound", deadline: new Date(Date.now() + 120_000).toISOString() };
  expect((await f.call("/v1/runs", launcher, { ...base, runId: crypto.randomUUID() })).status).toBe(201);
  expect((await f.call("/v1/runs", launcher, { ...base, runId: crypto.randomUUID(), instance })).status).toBe(409);
  const second = { ...base, subject: "bound-then-unbound" };
  expect((await f.call("/v1/runs", launcher, { ...second, runId: crypto.randomUUID(), instance })).status).toBe(201);
  expect((await f.call("/v1/runs", launcher, { ...second, runId: crypto.randomUUID() })).status).toBe(409);
});

test("expiry and policy changes refuse renewal and never expand a registered run", async () => {
  const f = await fixture();
  const runId = crypto.randomUUID();
  f.config.workloadRoles = ["runner"];
  await f.call("/v1/runs", await f.token("launcher"), {
    runId,
    subject: "vm",
    instance,
    deadline: new Date(Date.now() + 120_000).toISOString(),
  });
  const vm = await f.token("vm", { google: { compute_engine: instance } });
  f.config.workloadRoles.push("publisher");
  const response = await f.call("/v1/session", vm, { runId });
  expect(response.status).toBe(200);
  expect((await response.json()).credentials).toHaveLength(2);
  const grant = (await f.store.get(runId))!;
  await f.store.save({ ...grant, deadline: new Date(Date.now() - 1000).toISOString() });
  expect((await f.call("/v1/session", vm, { runId })).status).toBe(403);
  f.config.humans = [];
  expect((await f.call("/v1/session", await f.token("alice"), {})).status).toBe(403);
  await f.store.save({ ...grant, deadline: new Date(Date.now() - 8 * 86400_000).toISOString() });
  await f.store.cleanup();
  expect(await f.store.get(runId)).toBeNull();
});

test("broker storage checks the current run and isolates objects even when VMs share Google identity", async () => {
  const f = await fixture();
  const runId = crypto.randomUUID();
  const launcher = await f.token("launcher");
  await f.call("/v1/runs", launcher, {
    runId,
    subject: "shared-vm",
    instance,
    deadline: new Date(Date.now() + 120_000).toISOString(),
  });
  const session = await (
    await f.call("/v1/session", await f.token("shared-vm", { google: { compute_engine: instance } }), { runId })
  ).json();
  const credential = session.credentials.find((c: { connectionId: string }) => c.connectionId === "cloud-storage");
  const object = `sources/${crypto.randomUUID()}.tar.gz`;
  expect(
    (await f.call("/v1/storage/url", credential.secret, { method: "PUT", object, expiresSeconds: 1800 })).status,
  ).toBe(200);
  expect(f.signedObjects).toEqual([`owners/${(await f.store.get(runId))!.principalId}/${object}`]);
  expect(
    (
      await f.call("/v1/storage/url", credential.secret, {
        method: "GET",
        object: `owners/another-principal/${object}`,
        expiresSeconds: 1800,
      })
    ).status,
  ).toBe(400);
  await f.call(`/v1/runs/${runId}`, launcher, undefined, "DELETE");
  expect(
    (await f.call("/v1/storage/url", credential.secret, { method: "GET", object, expiresSeconds: 1800 })).status,
  ).toBe(403);
});

test("Microsoft sign-in discovers public configuration, issues the person's keys and isolates provider subjects", async () => {
  const f = await fixture(undefined, true);
  const discovery = await f.call("/v1/login/microsoft", "", undefined, "GET");
  expect(discovery.status).toBe(200);
  expect(await discovery.json()).toEqual({ tenantId: f.tenantId, clientId: f.clientId });
  const response = await f.call("/v1/session", await f.microsoftToken({ email: "changed@example.test" }), {});
  expect(response.status).toBe(200);
  const session = await response.json();
  expect(session.credentials.length).toBeGreaterThan(0);
  expect(
    f.requests.filter((r) => r.path.includes("/keys")).every((r) => r.path.includes(f.config.humans[1]!.principalId)),
  ).toBe(true);
  const spoof = await f.token(`${f.tenantId}:${f.objectId}`, { aud: "desktop-client" });
  expect((await f.call("/v1/session", spoof, {})).status).toBe(403);
  expect(
    (
      await f.call("/v1/runs", await f.microsoftToken(), {
        runId: crypto.randomUUID(),
        subject: "vm",
        deadline: new Date(Date.now() + 60000).toISOString(),
      })
    ).status,
  ).toBe(403);
});

test("Microsoft enrollment rejects other tenants, applications, invalid lifetimes and missing stable identities", async () => {
  const f = await fixture(undefined, true);
  for (const claims of [
    { tid: crypto.randomUUID() },
    { aud: "another-app" },
    { aud: [f.clientId, "another-app"] },
    { iss: `https://sts.windows.net/${f.tenantId}/` },
    { ver: "1.0" },
    { oid: undefined },
    { exp: 1 },
    { nbf: Math.floor(Date.now() / 1000) + 600 },
    { iat: Math.floor(Date.now() / 1000) + 600 },
  ])
    expect((await f.call("/v1/session", await f.microsoftToken(claims), {})).status).toBe(401);
  expect((await f.call("/v1/session", await f.microsoftToken({ oid: crypto.randomUUID() }), {})).status).toBe(403);
  const signed = await f.microsoftToken();
  const [header, payload, signature] = signed.split(".");
  const forged = `${header}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload!, "base64url").toString()), oid: crypto.randomUUID() })).toString("base64url")}.${signature}`;
  expect((await f.call("/v1/session", forged, {})).status).toBe(401);
  const unconfigured = await fixture();
  expect((await unconfigured.call("/v1/session", await f.microsoftToken(), {})).status).toBe(401);
});
