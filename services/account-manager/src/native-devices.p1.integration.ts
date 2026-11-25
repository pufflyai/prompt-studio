import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { createAuthorityFixture, deviceProfile } from "./authority.fixture";
import * as implementation from "./index";
import { authenticationConfig } from "./manager-authentication.fixture";
import {
  createOAuthCodeFixture,
  fixtureMicrosoftClient,
  fixtureMicrosoftTenant,
  oauthBrowserCookie,
} from "./oauth-code.fixture";
import { createOwnedTls } from "./owned-tls.fixture";

const fixture = createAuthorityFixture(implementation);
let cleanup = async () => {};
let origin: string;
let teamAccountId: string;
let certificate: string;
const googleSubject = `native-a-${crypto.randomUUID()}`;
const microsoftSubject = `native-ms-${crypto.randomUUID()}`;
const microsoftAccount = crypto.randomUUID();
beforeAll(() => fixture.initialize());
beforeAll(async () => {
  const tls = await createOwnedTls();
  const port = await new Promise<number>((done) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      server.close(() => done(address.port));
    });
  });
  origin = `https://127.0.0.1:${port}`;
  certificate = tls.cert;
  const auth = implementation.createManagerAuthentication({
    ...authenticationConfig(fixture.databaseUrl, { origin, audience: "https://relay.fixture.test" }),
    microsoft: fixtureMicrosoftClient,
  });
  const oauth = await createOAuthCodeFixture();
  let server: ReturnType<typeof Bun.serve> | undefined;
  cleanup = async () => {
    await server?.stop(true);
    oauth.close();
    await auth.close();
    await tls.close();
    await fixture.close();
  };
  const handler = implementation.createManagerHandler(auth, origin);
  server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    tls: { cert: Bun.file(tls.cert), key: Bun.file(tls.key) },
    async fetch(request) {
      const response = await handler(request);
      const subject = request.headers.get("x-fixture-oauth-subject");
      const url = new URL(request.url);
      if (url.pathname !== "/v1/native-login" || !subject || response.status !== 302) return response;

      const provider = url.searchParams.get("provider") === "microsoft" ? "microsoft" : "google";
      const callback = await oauth.complete(provider, new URL(response.headers.get("location")!), {
        claims: { sub: subject, email: `${subject}@fixture.test` },
      });
      return handler(new Request(callback, { headers: { cookie: oauthBrowserCookie(response) } }));
    },
  });
  const manager = fixture.owner();
  try {
    const accountId = crypto.randomUUID();
    await manager.provision({
      requestId: "native-early-access",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: googleSubject },
    });
    await manager.setFeature({ accountId, feature: "relay", enabled: true });
    await manager.provision({
      requestId: "native-microsoft-account",
      accountId: microsoftAccount,
      owner: { issuer: `https://login.microsoftonline.com/${fixtureMicrosoftTenant}/v2.0`, subject: microsoftSubject },
    });
    const seed = await manager.registerDevice({ accountId, ...deviceProfile() });
    const team = await auth.devices.createTeam(seed.token, "Cloud test team");
    teamAccountId = team.accountId;
    await manager.setFeature({ accountId: teamAccountId, feature: "relay", enabled: true });
    await manager.removeDevice({ accountId, deviceId: seed.deviceId });
  } finally {
    await manager.close();
  }
});
afterAll(() => cleanup());

const nativeFixture = (file: string, subjects: Record<string, string>) => {
  const child = Bun.spawn(
    [process.execPath, resolve(import.meta.dir, "../../../packages/pstdio-api/src/services/account", file)],
    {
      env: {
        ...process.env,
        NODE_EXTRA_CA_CERTS: certificate,
        OWNER_TEST_ORIGIN: origin,
        OWNER_TEST_TEAM: teamAccountId,
        PSTDIO_DEFAULT_EXTENSIONS: "[]",
        ...subjects,
      },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
    },
  );
  const reader = child.stdout.getReader();
  let output: Promise<void>;
  return {
    async ready() {
      let startup = "";
      while (!startup.includes("NATIVE_RUNTIME_READY")) {
        const { done, value } = await reader.read();
        if (done) throw new Error(`Native runtime fixture did not start: ${file}`);
        const text = new TextDecoder().decode(value);
        process.stdout.write(text);
        startup += text;
      }
      output = (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) return;
          process.stdout.write(value);
        }
      })();
    },
    async run() {
      child.stdin.write("run\n");
      child.stdin.end();
      expect(await child.exited).toBe(0);
      await output;
    },
    async close() {
      if (child.exitCode === null) child.kill();
      await child.exited;
    },
  };
};

describe("Google native sign-in", () => {
  let native: ReturnType<typeof nativeFixture> | undefined;
  beforeAll(async () => {
    native = nativeFixture("native-devices.integration.fixture.ts", {
      OWNER_TEST_SUBJECT_A: googleSubject,
      OWNER_TEST_SUBJECT_B: `native-b-${crypto.randomUUID()}`,
    });
    await native.ready();
  });
  afterAll(() => native?.close());

  test("two native hosts log in as devices of one user and manage each other through the real manager", () =>
    native!.run());
});

describe("Microsoft native sign-in", () => {
  let native: ReturnType<typeof nativeFixture> | undefined;
  beforeAll(async () => {
    native = nativeFixture("native-microsoft-login.integration.fixture.ts", {
      OWNER_TEST_MICROSOFT_SUBJECT: microsoftSubject,
      OWNER_TEST_MICROSOFT_ACCOUNT: microsoftAccount,
    });
    await native.ready();
  });
  afterAll(() => native?.close());

  test("the native host saves its Microsoft device login across a restart", () => native!.run());
});
