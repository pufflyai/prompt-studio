import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import yargs from "yargs";
import { builder, command, createHandler, describe } from "./import";

test("agent CLI previews and starts an import using the project-map file and structured JSON output", async () => {
  const root = await mkdtemp(join(tmpdir(), "session-import-cli-"));
  const requests: { path: string; body: unknown }[] = [];
  const output: unknown[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (request) => {
      requests.push({ path: new URL(request.url).pathname, body: await request.json() });
      return Response.json({ id: "import", status: "running" });
    },
  });
  try {
    const mapping = join(root, "mapping.json");
    await writeFile(mapping, JSON.stringify({ old: "current" }));
    const client = createClient({ baseUrl: `http://127.0.0.1:${server.port}` });
    const handler = createHandler({ client: () => client, log: (value) => output.push(JSON.parse(value)) });
    const cli = () =>
      yargs([])
        .exitProcess(false)
        .fail((message, error) => {
          throw error ?? new Error(message);
        })
        .parserConfiguration({ "camel-case-expansion": true })
        .command({ command, describe, builder, handler })
        .strict();
    await cli().parseAsync(["import", "--source", root, "--storage", root, "--project-map", mapping, "--dry-run"]);
    await cli().parseAsync(["import", "--source", root, "--storage", root, "--project-map", mapping]);
    expect(requests).toEqual([
      {
        path: "/v1/session-imports/preview",
        body: { sourcePath: root, storagePath: root, projectMap: { old: "current" } },
      },
      { path: "/v1/session-imports", body: { sourcePath: root, storagePath: root, projectMap: { old: "current" } } },
    ]);
    expect(output).toEqual([
      { id: "import", status: "running" },
      { id: "import", status: "running" },
    ]);
    await expect(cli().parseAsync(["import", "--source", root])).rejects.toThrow("--project-map");
    expect(requests).toHaveLength(2);
  } finally {
    server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
