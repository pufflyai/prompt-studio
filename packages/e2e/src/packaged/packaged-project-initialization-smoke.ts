import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerProjectInitializationSmokeTests = () => {
  test("upgraded packaged extensions migrate every existing project on restart", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-project-migration-"));
    let child: ChildProcess | undefined;
    try {
      const source = join(root, "source");
      mkdirSync(source);
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "migration-probe",
          version: "1.0.0",
          publisher: "test",
          type: "module",
          main: "./extension.ts",
          engines: { pstdio: EXTENSION_API_VERSION },
        }),
      );
      writeFileSync(join(source, "extension.ts"), "export default {};\n");
      const env = {
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
          { source, installName: "migration-probe", skipInstall: true, force: true },
        ]),
      };
      const started = await startPackagedServe(root, env);
      child = started.child;
      const projects: Array<{ id: string; path: string }> = [];
      for (const name of ["first", "second"]) {
        const path = join(root, name);
        mkdirSync(path);
        const response = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify(folderProjectInput({ name }, path)),
        });
        expect(response.status).toBe(201);
        const { id } = (await response.json()) as { id: string };
        projects.push({ id, path });
        writeFileSync(join(path, "legacy.json"), JSON.stringify({ id, title: "Keep my data", version: 0 }));
      }
      await stopProcess(child);
      writeFileSync(
        join(source, "extension.ts"),
        `export default {
        hooks: [{ id: "migrate", ref: { kind: "hook", id: "migrate" },
          event: { extensionId: "pstdio", kind: "event", id: "project.opened" },
          async run(ctx) {
            const legacy = await ctx.projectFiles.readText("legacy.json");
            if (!legacy) return;
            const data = JSON.parse(legacy);
            await ctx.projectFiles.writeText("migrated.json", JSON.stringify({ ...data, version: 1 }));
          }
        }]
      };`,
      );
      child = (await startPackagedServe(root, env)).child;
      const deadline = Date.now() + 5_000;
      while (projects.some(({ path }) => !existsSync(join(path, "migrated.json"))) && Date.now() < deadline) {
        await Bun.sleep(20);
      }
      for (const { id, path } of projects) {
        expect(JSON.parse(readFileSync(join(path, "migrated.json"), "utf8"))).toEqual({
          id,
          title: "Keep my data",
          version: 1,
        });
      }
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  });
};
