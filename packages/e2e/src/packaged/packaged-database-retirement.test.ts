import { beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { buildBinary } from "./packaged-helpers";
import { startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
import { prepareReleasedStorageHost } from "./released-storage-host";

let releasedBinary: string;
beforeAll(async () => {
  releasedBinary = await prepareReleasedStorageHost();
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
}, 180_000);

// The runtime is still writing this log, so only newline-terminated lines are complete.
const startupPhases = async (path: string) =>
  (await Bun.file(path).text())
    .split("\n")
    .slice(0, -1)
    .map((line) => JSON.parse(line) as { event?: string; phase?: string })
    .filter((entry) => entry.event === "runtime.startup.phase" && entry.phase?.startsWith("database_retir"))
    .map((entry) => entry.phase);

const jsonLines = async (path: string) =>
  (await Bun.file(path).text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

test(
  "a packaged 0.45 home is exported as JSON and moved aside, and the new release starts empty",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "packaged-database-retirement-"));
    const source = join(root, "source");
    let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    try {
      await mkdir(source);
      await Bun.write(
        join(source, "extension.ts"),
        `export default {
          commands: [{ id: "seed", ref: { kind: "command", id: "seed" }, title: "Seed", mutating: true,
            async run(ctx) {
              await ctx.storage.records.commit({ operationId: "seed", edits: [
                { recordId: "ticket-1", replace: { title: "Kept for re-import", files: [{ name: "plan.md", content: "# Plan" }] } }
              ] });
              return ctx.storage.records.read("ticket-1");
            } }]
        };`,
      );
      await Bun.write(
        join(source, "package.json"),
        JSON.stringify({
          name: "retired-data",
          publisher: "example",
          version: "1.0.0",
          main: "extension.ts",
          engines: { pstdio: "^0.2.1" },
        }),
      );
      const env = { PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "retired-data" }]) };
      host = await startPackagedServe(root, env, releasedBinary);
      const request = async (method: string, path: string, body?: unknown) => {
        const response = await fetch(host!.baseUrl + path, {
          method,
          headers: { authorization: `Bearer ${host!.descriptor.token}`, "content-type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const value = await response.json();
        expect(response.status, JSON.stringify(value)).toBeLessThan(300);
        return value;
      };
      const project = await request("POST", "/v1/projects", folderProjectInput({ name: "Retired project" }, root));
      const seeded = await request(
        "POST",
        `/v1/projects/${project.id}/extensions/commands/example.retired-data.command.seed/execute`,
        { params: {} },
      );
      expect(seeded.outcome).toMatchObject({ ok: true });
      await stopProcess(host.child);

      const firstLog = join(root, "first.log");
      host = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]", PSTDIO_LOG_PATH: firstLog });
      expect(await startupPhases(firstLog)).toEqual(["database_retiring", "database_retired"]);
      expect(await request("GET", "/v1/projects")).toEqual([]);

      const [backup] = await readdir(join(root, "backups"));
      const exported = join(root, "backups", backup, "export");
      const exportError = Bun.file(join(root, "backups", backup, "export-error.txt"));
      expect((await exportError.exists()) ? await exportError.text() : "").toBe("");
      expect(await jsonLines(join(exported, "tables", "public.projects.jsonl"))).toEqual([
        expect.objectContaining({ id: project.id, name: "Retired project" }),
      ]);
      expect(await jsonLines(join(exported, "extension-records", project.id, "example.retired-data.jsonl"))).toEqual([
        expect.objectContaining({
          recordId: "ticket-1",
          deleted: false,
          value: { title: "Kept for re-import", files: [{ name: "plan.md", content: "# Plan" }] },
        }),
      ]);
      expect(await readdir(join(root, "backups", backup, "database"))).toContain("PG_VERSION");
      await stopProcess(host.child);

      const restartLog = join(root, "restart.log");
      host = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]", PSTDIO_LOG_PATH: restartLog });
      expect(await startupPhases(restartLog)).toEqual([]);
      expect(await readdir(join(root, "backups"))).toEqual([backup]);
    } finally {
      try {
        if (host) await stopProcess(host.child);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
