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
let drops = 2;
let renewalUnavailable = false;
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
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/fixture/renewal-outage") {
        renewalUnavailable = true;
        return Response.json({ ok: true });
      }
      if (path === "/v1/environment-access" && renewalUnavailable) {
        renewalUnavailable = false;
        return new Response(null, { status: 503 });
      }
      const response = await handler(request);
      if (
        drops > 0 &&
        request.method === "POST" &&
        /\/environments(?:\/replace)?$/.test(path) &&
        response.status === 201
      ) {
        const result = (await response.clone().json()) as { token: string | null };
        if (result.token) {
          drops -= 1;
          return new Response(null, { status: 503 });
        }
      }
      return response;
    },
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
  const a = await authentication.login(`native-a-${crypto.randomUUID()}`);
  const b = await authentication.login(`native-b-${crypto.randomUUID()}`);
  child = Bun.spawn(
    [
      process.execPath,
      resolve(import.meta.dir, "../../../packages/pstdio-api/src/services/account/native-enrollment.integration.ts"),
    ],
    {
      env: {
        ...process.env,
        NODE_EXTRA_CA_CERTS: tls.cert,
        OWNER_TEST_ORIGIN: origin,
        OWNER_TEST_COOKIE_A: a.headers.get("cookie")!,
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

test("native enrollment uses the real owner authority across lost responses and runtime restart", async () => {
  child.stdin.write("run\n");
  child.stdin.end();
  expect(await child.exited).toBe(0);
  await output;
  expect(drops).toBe(0);
});
