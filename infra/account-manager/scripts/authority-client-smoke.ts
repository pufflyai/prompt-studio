import { strict as assert } from "node:assert";

const implementation: typeof import("../src/environment-authority-client") = await import(
  new URL("./authority-client.js", import.meta.url).href
);
try {
  assert.equal(process.env.MANAGER_TEST_ADMIN_URL, undefined);
  assert.equal(process.env.MANAGER_DATABASE_URL, undefined);
  const config = {
    origin: process.env.AUTHORITY_ORIGIN!,
    serviceSecret: process.env.AUTHORITY_SERVICE_SECRET!,
    requestTimeoutMs: 1000,
  };
  const client = implementation.createEnvironmentAuthorityClient(config, async (url, options) => {
    assert.equal(url, "https://manager.example.test/internal/v1/environment-authority");
    return fetch(new URL(new URL(url).pathname, process.env.AUTHORITY_FIXTURE_URL), options);
  });
  const identity = await client.authorize(process.env.AUTHORITY_ENVIRONMENT_TOKEN!, process.env.AUTHORITY_WORKBENCH!);
  process.stdout.write(JSON.stringify({ identity }));
} catch (error) {
  process.stderr.write(Bun.inspect(error, { depth: Infinity }));
  process.exitCode = 1;
}
