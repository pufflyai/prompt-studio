import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

test(
  "packaged watched mounts refresh when the initial tree exceeds the folder limit",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-artifact-watch-limit-"));
    let child: ChildProcess | undefined;
    try {
      const source = join(root, "source");
      mkdirSync(source);
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "watch-limit",
          publisher: "test",
          version: "1.0.0",
          type: "module",
          main: "./extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      writeFileSync(
        join(source, "extension.ts"),
        `export default {
      artifactMounts: [{ id: "files", ref: { kind: "artifact-mount", id: "files" }, path: "files", label: "Files", watch: true }],
      hooks: [{ id: "record", ref: { kind: "hook", id: "record" }, event: { kind: "event", id: "artifact.changed:files" },
        run: async (ctx, payload) => {
          await ctx.extensionFiles.writeText("refresh.json", JSON.stringify(payload));
          await ctx.extensionFiles.writeText("refresh-ready", "");
        } }],
    };`,
      );
      const projectFolder = join(root, "project");
      const storage = join(projectFolder, ".pstdio", "extension-storage", "test.watch-limit");
      const mount = join(storage, "files");
      mkdirSync(mount, { recursive: true });
      for (let index = 0; index < 2_001; index++) mkdirSync(join(mount, String(index)));

      const started = await startPackagedServe(root, {
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "watch-limit" }]),
      });
      child = started.child;
      const response = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Watch limit" }, projectFolder)),
      });
      expect(response.status).toBe(201);
      const project = (await response.json()) as { id: string };
      const extensions = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`, {
        headers: runtimeAuthorization(started.descriptor),
      });
      expect(extensions.status).toBe(200);
      expect((await extensions.json()).extensions).toContainEqual(
        expect.objectContaining({ enabled: true, installName: "watch-limit" }),
      );

      // Native recursive watches have no per-folder limit. Exercise their normal refresh too.
      if (process.platform === "darwin" || process.platform === "win32") {
        // Native streams can drop edits made immediately after startup.
        await Bun.sleep(100);
        writeFileSync(join(mount, "changed.json"), "{}");
      }
      const receipt = join(storage, "refresh.json");
      const completed = join(storage, "refresh-ready");
      const deadline = Date.now() + 5_000;
      while (!existsSync(completed)) {
        if (Date.now() > deadline) throw new Error("Watched mount did not request a refresh");
        await Bun.sleep(10);
      }
      const payload = JSON.parse(readFileSync(receipt, "utf8"));
      expect(payload.mount).toBe("files");
      if (process.platform === "linux") expect(payload.paths).toEqual([]);
      else expect(payload.paths).toContain("changed.json");
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
