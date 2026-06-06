import { resolve } from "node:path";
import { createExtensionTestbenchApi } from "./testbench-api";

const apiPrefix = "/__extension-testbench";
const sourceDir = import.meta.dirname;
const repoRoot = resolve(sourceDir, "../../../..");
const hostname = process.env.EXTENSION_TESTBENCH_API_HOST ?? "127.0.0.1";
const port = Number(process.env.EXTENSION_TESTBENCH_API_PORT ?? "6174");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

const api = createExtensionTestbenchApi({ apiPrefix, repoRoot });
const server = Bun.serve({
  fetch: async (request) =>
    (await api.handleRequest(request)) ?? json({ error: "Unknown extension testbench endpoint." }, 404),
  hostname,
  port,
});

const shutdown = (exitCode: number) => {
  api.cleanup();
  server.stop();
  process.exit(exitCode);
};

process.once("SIGINT", () => shutdown(130));
process.once("SIGTERM", () => shutdown(143));
process.once("exit", () => api.cleanup());
