import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestCronDriver } from "pstdio-scheduler/testing";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { createExtensionScheduler } from "./extension-scheduler";

const expectRedactedLog = (logPath: string) => {
  const log = readFileSync(logPath, "utf8");
  expect(log).toContain("extension.connection.request.completed");
  for (const secret of ["provider-code-canary", "access-canary", "refresh-canary", "refresh-secret-canary"]) {
    expect(log).not.toContain(secret);
  }
};

const writeOAuthFixture = (root: string, providerUrl: URL) => {
  const sourcePath = join(root, "oauth-fixture");
  mkdirSync(sourcePath);
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "oauth-fixture",
      publisher: "pstdio",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `export default {
    connections: [{
      id: "crm", label: "CRM", ref: { kind: "connection", id: "crm" }, transport: "http",
      auth: { type: "oauth", baseUrl: ${JSON.stringify(providerUrl.origin)},
        authorizationEndpoint: ${JSON.stringify(new URL("/authorize", providerUrl))},
        tokenEndpoint: ${JSON.stringify(new URL("/token", providerUrl))},
        clientId: "test-client", scopes: ["read"] },
      allowedMethods: ["GET"], allowedPathPrefixes: ["/accounts"]
    }],
    commands: [{
      id: "read", title: "Read accounts", ref: { kind: "command", id: "read" },
      async run(ctx) {
        try {
          return (await ctx.connections.request("crm", {
            method: "GET", path: "/accounts", headers: { "x-command-source": ctx.source }
          })).body;
        }
        catch { return await ctx.connections.oauthStatus("crm"); }
      }
    }],
    schedules: ["first", "second"].map(id => ({
      id, title: id, ref: { kind: "schedule", id }, schedule: "0 0 1 1 *", command: { kind: "command", id: "read" }
    }))
  };`,
  );
  return sourcePath;
};

test("browser consent enables a named REST connection and a restarted host refreshes it once", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-oauth-"));
  const originalHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const originalLogPath = process.env.PSTDIO_LOG_PATH;
  const originalLogLevel = process.env.PSTDIO_LOG_LEVEL;
  const logPath = join(root, "runtime.log");
  process.env.PSTDIO_LOG_PATH = logPath;
  process.env.PSTDIO_LOG_LEVEL = "info";
  let codeExchange = 0;
  let refreshes = 0;
  let challenge = "";
  let revoked = false;
  let pauseRefresh:
    | {
        started: ReturnType<typeof Promise.withResolvers<void>>;
        resume: ReturnType<typeof Promise.withResolvers<void>>;
      }
    | undefined;
  const scheduledRequests: string[] = [];
  const provider = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      switch (new URL(request.url).pathname) {
        case "/authorize": {
          const query = new URL(request.url).searchParams;
          expect(query.get("code_challenge_method")).toBe("S256");
          challenge = query.get("code_challenge")!;
          const callback = new URL(query.get("redirect_uri")!);
          callback.searchParams.set("state", query.get("state")!);
          callback.searchParams.set("code", "provider-code-canary");
          return Response.redirect(callback);
        }
        case "/token": {
          const form = new URLSearchParams(await request.text());
          if (form.get("grant_type") === "authorization_code") {
            codeExchange++;
            expect(form.get("code")).toBe("provider-code-canary");
            expect(new Bun.CryptoHasher("sha256").update(form.get("code_verifier")!).digest("base64url")).toBe(
              challenge,
            );
            return Response.json({
              access_token: "access-canary",
              refresh_token: "refresh-canary",
              token_type: "Bearer",
              expires_in: 0,
            });
          }
          refreshes++;
          if (pauseRefresh) {
            pauseRefresh.started.resolve();
            await pauseRefresh.resume.promise;
          }
          if (revoked)
            return Response.json(
              { error: "invalid_grant", error_description: "refresh-secret-canary" },
              { status: 400 },
            );
          expect(form.get("refresh_token")).toBe("refresh-canary");
          return Response.json({
            access_token: "rotated-access-canary",
            refresh_token: "rotated-refresh-canary",
            token_type: "Bearer",
            expires_in: 3600,
          });
        }
        case "/accounts":
          if (
            request.headers.get("x-command-source") === "schedule" &&
            request.headers.get("authorization") === "Bearer rotated-access-canary"
          )
            scheduledRequests.push("Acme");
          return request.headers.get("authorization") === "Bearer rotated-access-canary" && !revoked
            ? Response.json({ accounts: ["Acme"] })
            : new Response(null, { status: 401 });
        default:
          return new Response(null, { status: 404 });
      }
    },
  });

  const open = () =>
    createTestApp({
      databasePath: join(root, "db"),
      storageRoot: join(root, "storage"),
      host: { kind: "standalone", token: "test-runtime" },
    });
  let app: Awaited<ReturnType<typeof open>> | undefined;
  let scheduler: ReturnType<typeof createExtensionScheduler> | undefined;
  try {
    app = await open();
    const call = (path: string | URL, method = "GET", body?: object) =>
      app!.app.request(path.toString(), {
        method,
        headers: { authorization: "Bearer test-runtime", ...(body && { "content-type": "application/json" }) },
        body: body && JSON.stringify(body),
      });
    const created = await call("/v1/projects", "POST", folderProjectInput({ name: "OAuth fixture" }));
    expect(created.status).toBe(201);
    const { id: projectId } = await created.json();
    const sourcePath = writeOAuthFixture(root, provider.url);
    const enabled = await call(`/v1/projects/${projectId}/extensions/installed/oauth-fixture/enable`, "POST", {
      displayName: "OAuth fixture",
      extensionId: "pstdio.oauth-fixture",
      manifest: { id: "pstdio.oauth-fixture", name: "oauth-fixture" },
      name: "oauth-fixture",
      sourceHash: null,
      sourceKind: "local_path",
      sourcePath,
      sourceRef: null,
      version: null,
    });
    expect(enabled.status).toBe(200);

    const oauth = `/v1/projects/${projectId}/extension-connections/pstdio.oauth-fixture/crm/oauth`;
    expect((await app.app.request(oauth, { method: "POST" })).status).toBe(401);
    expect(await (await call(oauth)).json()).toEqual({ status: "disconnected" });
    const start = await call(oauth, "POST");
    expect(start.status).toBe(200);
    const { authorizationUrl } = await start.json();
    const signedIn = await fetch(authorizationUrl, { redirect: "manual" });
    const callback = signedIn.headers.get("location")!;
    expect((await app.app.request(callback)).status).toBe(200);
    expect((await app.app.request(callback)).status).toBe(400);
    expect(codeExchange).toBe(1);

    await app.close();
    app = undefined;
    app = await open();
    const read = async () => {
      const response = await call(
        `/v1/projects/${projectId}/extensions/commands/pstdio.oauth-fixture.command.read/execute`,
        "POST",
        {},
      );
      const result = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(result));
      return result;
    };
    const cron = createTestCronDriver();
    scheduler = createExtensionScheduler({
      deps: app.deps,
      listProjectIds: async () => [projectId],
      watermarkPath: join(root, "test-scheduler-watermarks.json"),
      cron: cron.factory,
      now: () => new Date("2028-01-01T00:00:00Z"),
    });
    await scheduler.refresh();
    expect(cron.size()).toBe(2);
    await cron.fireAll();
    expect(scheduledRequests).toEqual(["Acme", "Acme"]);
    expect(refreshes).toBe(1);
    await scheduler.dispose();
    scheduler = undefined;
    expect(JSON.stringify(await read())).toContain("Acme");

    revoked = true;
    const reconnect = await read();
    expect(JSON.stringify(reconnect)).toContain("reconnect_required");
    expect(refreshes).toBe(2);
    await read();
    expect(refreshes).toBe(2);
    expect(await (await call(oauth)).json()).toMatchObject({ status: "reconnect_required" });
    expect((await call(oauth, "DELETE")).status).toBe(204);
    expect(await (await call(oauth)).json()).toEqual({ status: "disconnected" });

    revoked = false;
    const reconnectStart = await (await call(oauth, "POST")).json();
    const consent = await fetch(reconnectStart.authorizationUrl, { redirect: "manual" });
    expect((await app.app.request(consent.headers.get("location")!)).status).toBe(200);
    pauseRefresh = { started: Promise.withResolvers(), resume: Promise.withResolvers() };
    const inFlight = read();
    try {
      await Promise.race([
        pauseRefresh.started.promise,
        inFlight.then(() => {
          throw new Error("Refresh did not start.");
        }),
      ]);
      expect((await call(oauth, "DELETE")).status).toBe(204);
    } finally {
      pauseRefresh.resume.resolve();
    }
    expect(JSON.stringify(await inFlight)).toContain("disconnected");
    expect(await (await call(oauth)).json()).toEqual({ status: "disconnected" });
    expectRedactedLog(logPath);
  } finally {
    pauseRefresh?.resume.resolve();
    await scheduler?.dispose();
    await app?.close();
    await provider.stop(true);
    if (originalHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = originalHome;
    if (originalLogPath === undefined) delete process.env.PSTDIO_LOG_PATH;
    else process.env.PSTDIO_LOG_PATH = originalLogPath;
    if (originalLogLevel === undefined) delete process.env.PSTDIO_LOG_LEVEL;
    else process.env.PSTDIO_LOG_LEVEL = originalLogLevel;
    rmSync(root, { recursive: true, force: true });
  }
}, 60_000);
