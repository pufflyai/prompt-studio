import { afterAll, beforeAll, expect, test } from "bun:test";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { createAuthorityFixture } from "./authority.fixture";
import * as implementation from "./index";
import { authenticationConfig } from "./manager-authentication.fixture";
import { createOAuthCodeFixture, oauthBrowserCookie } from "./oauth-code.fixture";
import { createOwnedTls } from "./owned-tls.fixture";

const fixture = createAuthorityFixture(implementation);
let cleanup = async () => {};
let child: Bun.Subprocess<"pipe", "pipe", "inherit">;
let output: Promise<void>;
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
  const origin = `https://127.0.0.1:${port}`;
  const auth = implementation.createManagerAuthentication(
    authenticationConfig(fixture.databaseUrl, { origin, audience: "https://relay.fixture.test" }),
  );
  const oauth = await createOAuthCodeFixture();
  let server: ReturnType<typeof Bun.serve> | undefined;
  cleanup = async () => {
    if (child && child.exitCode === null) {
      child.kill();
      await child.exited;
    }
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
      const subject = request.headers.get("x-fixture-google-subject");
      if (new URL(request.url).pathname !== "/v1/native-login" || !subject || response.status !== 302) return response;

      const provider = new URL(response.headers.get("location")!);
      const callback = await oauth.complete("google", provider, {
        claims: { sub: subject, email: `${subject}@fixture.test` },
      });
      return handler(new Request(callback, { headers: { cookie: oauthBrowserCookie(response) } }));
    },
  });
  const subject = `native-a-${crypto.randomUUID()}`;
  const manager = fixture.owner();
  try {
    const accountId = crypto.randomUUID();
    await manager.provision({
      requestId: "native-early-access",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject },
    });
    await manager.setFeature({ accountId, feature: "relay", enabled: true });
  } finally {
    await manager.close();
  }
  child = Bun.spawn(
    [
      process.execPath,
      resolve(
        import.meta.dir,
        "../../../packages/pstdio-api/src/services/account/native-devices.integration.fixture.ts",
      ),
    ],
    {
      env: {
        ...process.env,
        NODE_EXTRA_CA_CERTS: tls.cert,
        OWNER_TEST_ORIGIN: origin,
        OWNER_TEST_SUBJECT_A: subject,
        OWNER_TEST_SUBJECT_B: `native-b-${crypto.randomUUID()}`,
        PSTDIO_DEFAULT_EXTENSIONS: "[]",
      },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
    },
  );
  const reader = child.stdout.getReader();
  let startup = "";
  while (!startup.includes("NATIVE_RUNTIME_READY")) {
    const { done, value } = await reader.read();
    if (done) throw new Error("Native runtime fixture did not start");
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
});
afterAll(() => cleanup());

test("two native hosts log in as devices of one user and manage each other through the real manager", async () => {
  child.stdin.write("run\n");
  child.stdin.end();
  expect(await child.exited).toBe(0);
  await output;
});
