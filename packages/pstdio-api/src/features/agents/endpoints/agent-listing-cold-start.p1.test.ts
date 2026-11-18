import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { get } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { disableExtensionPreparationTimeout } from "../../extensions/extension-request-timeout";
import { installExtensionSource } from "../../extensions/install-extension-source";

const root = mkdtempSync(join(tmpdir(), "pstdio-cold-agent-listing-"));
const previousDefaults = process.env.PSTDIO_DEFAULT_EXTENSIONS;
const previousHome = process.env.PSTDIO_HOME;

beforeAll(() => {
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
});
afterAll(() => {
  if (previousDefaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaults;
  if (previousHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousHome;
  rmSync(root, { recursive: true, force: true });
});

// node:http sends exactly one request; it does not retry a connection closed before headers.
const readListing = (url: string) =>
  new Promise<{ status: number | undefined; body: unknown }>((resolve, reject) => {
    get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("error", reject);
      response.on("end", () => {
        try {
          resolve({ status: response.statusCode, body: JSON.parse(body) });
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });

test.each([
  "info",
  "query",
])("serves agent %s after cold extension preparation exceeds the HTTP idle limit", async (endpoint) => {
  process.env.PSTDIO_HOME = join(root, endpoint, "home");
  const source = join(root, endpoint, "source");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "cold-listed-harness",
      publisher: "pstdio",
      version: "1.0.0",
      type: "module",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  const marker = join(root, endpoint, "cold-start");
  writeFileSync(
    join(source, "extension.ts"),
    `
import { existsSync, unlinkSync } from "node:fs";
if (existsSync(${JSON.stringify(marker)})) {
  unlinkSync(${JSON.stringify(marker)});
  await new Promise((resolve) => setTimeout(resolve, 17_000));
}
const run = () => ({ done: Promise.resolve({ status: "completed" }), stop: () => {} });
export default { harnesses: [{
  id: "cold", ref: { kind: "harness", id: "cold" }, label: "Cold harness",
  capabilities: () => [], detect: async () => ({ available: true }), start: run, resume: run,
}] };
`,
  );
  await installExtensionSource({ source, skipInstall: true });
  // Validation installs a fast module; the first host load then models cold preparation.
  writeFileSync(marker, "");
  const { app, close } = await createTestApp();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 1,
    fetch(request, server) {
      disableExtensionPreparationTimeout(request, server);
      return app.fetch(request, server);
    },
  });
  try {
    const response = await readListing(`http://127.0.0.1:${server.port}/v1/agents/${endpoint}`);
    expect(response.status).toBe(200);
    const agents = endpoint === "info" ? response.body : (response.body as { items: unknown }).items;
    expect(agents).toEqual([
      expect.objectContaining({
        id: "pstdio.cold-listed-harness.harness.cold",
        availability: { type: "INSTALLED" },
      }),
    ]);
  } finally {
    server.stop(true);
    await close();
  }
}, 45_000);
