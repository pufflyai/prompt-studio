import { afterAll, beforeAll, expect, test } from "bun:test";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { createAuthorityFixture } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";
import { createOwnedTls } from "./owned-tls.fixture";

const fixture = createAuthorityFixture(implementation);
let cleanup = async () => {};
let child: Bun.Subprocess<"pipe", "pipe", "inherit">;
let output: Promise<void>;
beforeAll(() => fixture.initialize());
beforeAll(async () => {
  const tls = await createOwnedTls();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const port = await new Promise<number>((done) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      server.close(() => done(address.port));
    });
  });
  const origin = `https://127.0.0.1:${port}`;
  const auth = implementation.createManagerAuthentication({ ...authentication.config, origin });
  const handler = implementation.createManagerHandler(auth, origin);
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    tls: { cert: Bun.file(tls.cert), key: Bun.file(tls.key) },
    fetch: handler,
  });
  cleanup = async () => {
    if (child && child.exitCode === null) {
      child.kill();
      await child.exited;
    }
    await server.stop(true);
    await Promise.all([auth.close(), authentication.close()]);
    await tls.close();
    await fixture.close();
  };
  // Each login signs out the Google session it used, so every device login gets its own session.
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
  const [a, again, b] = [
    await authentication.login(subject),
    await authentication.login(subject),
    await authentication.login(`native-b-${crypto.randomUUID()}`),
  ];
  child = Bun.spawn(
    [
      process.execPath,
      resolve(import.meta.dir, "../../../packages/pstdio-api/src/services/account/native-devices.integration.ts"),
    ],
    {
      env: {
        ...process.env,
        NODE_EXTRA_CA_CERTS: tls.cert,
        OWNER_TEST_ORIGIN: origin,
        OWNER_TEST_COOKIE_A: a.headers.get("cookie")!,
        OWNER_TEST_COOKIE_A_AGAIN: again.headers.get("cookie")!,
        OWNER_TEST_COOKIE_B: b.headers.get("cookie")!,
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
