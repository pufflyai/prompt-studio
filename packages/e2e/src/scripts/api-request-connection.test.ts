import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("expires pooled API connections before the server's advertised deadline", async () => {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 20,
    fetch: (request, listener) =>
      Response.json({ port: listener.requestIP(request)?.port }, { headers: { "Keep-Alive": "timeout=2" } }),
  });
  const playwright = fileURLToPath(import.meta.resolve("@playwright/test"));
  const script = `
import assert from "node:assert/strict";
import { request } from ${JSON.stringify(playwright)};
const first = await request.newContext();
const previous = await (await first.post(${JSON.stringify(String(server.url))})).json();
const reused = await (await first.post(${JSON.stringify(String(server.url))})).json();
assert.equal(reused.port, previous.port, "Healthy API connections should remain reusable");
await first.dispose();
await new Promise(resolve => setTimeout(resolve, 1400));
const second = await request.newContext();
try {
  const current = await (await second.post(${JSON.stringify(String(server.url))})).json();
  assert.notEqual(current.port, previous.port, "An API context reused a socket past its safe keep-alive deadline");
} finally {
  await second.dispose();
}
`;
  try {
    const child = Bun.spawn(["node", "--input-type=module", "-e", script], { stdout: "pipe", stderr: "pipe" });
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(code, `${stdout}${stderr}`).toBe(0);
  } finally {
    server.stop(true);
  }
});
