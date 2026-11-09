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

const source = `
const ready = (directory) => ({
  providerRef: { version: 1, data: { path: directory.path } },
  state: "ready", executionKind: "local", executionTarget: { kind: "local", rootPath: directory.path },
  capabilities: { files: "write", diff: false, merge: false, rebase: false, delete: true },
});
export default { workspaceTypes: [{
  id: "local", ref: { kind: "workspace-type", id: "local" }, label: "Local provider",
  async discover(ctx) {
    const revision = (await ctx.projectFiles.readText("revision.txt")).trim();
    return revision === "unavailable" ? null : { params: { revision: { type: "text", defaultValue: revision } } };
  },
  async create(ctx, input) {
    const directory = await ctx.localDirectory();
    await directory.files.writeText("identity.json", JSON.stringify({ id: input.workspaceId, ...input.params }));
    const process = await ctx.process.runOrThrow({ command: ["bun", "-e", "process.stdout.write(process.cwd())"], cwd: directory.path });
    if (process.stdout !== directory.path) throw new Error("Unexpected process directory");
    return ready(directory);
  },
  async resolve(ctx) { return ready(await ctx.localDirectory()); },
  async delete(ctx) { await (await ctx.localDirectory()).remove(); },
}] };
`;

setupPackagedSmokeTests();

test(
  "packaged installed providers discover choices and prepare local directories before readiness",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-local-provider-"));
    let child: ChildProcess | undefined;
    try {
      const sourcePath = join(root, "extension");
      const folder = join(root, "project");
      mkdirSync(sourcePath);
      mkdirSync(folder);
      writeFileSync(join(folder, "revision.txt"), "main");
      writeFileSync(join(sourcePath, "extension.ts"), source);
      const manifest = {
        name: "local-provider",
        publisher: "test",
        version: "1.0.0",
        main: "./extension.ts",
        type: "module",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      };
      writeFileSync(join(sourcePath, "package.json"), JSON.stringify(manifest));
      const runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
      child = runtime.child;
      const headers = { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" };
      const request = async (path: string, body?: unknown, method = body === undefined ? "GET" : "POST") => {
        const response = await fetch(`${runtime.baseUrl}/v1${path}`, {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const value = await response.json();
        expect(response.status, JSON.stringify(value)).toBeLessThan(300);
        return value;
      };
      const project = await request("/projects", folderProjectInput({ name: "Local provider" }, folder));
      await request(`/projects/${project.id}/extensions/installed/local-provider/enable`, {
        displayName: "Local provider",
        extensionId: "test.local-provider",
        name: "local-provider",
        manifest,
        sourceKind: "local_path",
        sourcePath,
        sourceHash: null,
        sourceRef: null,
        version: "1.0.0",
      });
      const providerId = "test.local-provider.workspace-type.local";
      const providers = `/projects/${project.id}/workspace-providers`;
      expect(await request(providers)).toMatchObject([
        { id: providerId, params: { revision: { defaultValue: "main" } } },
      ]);
      writeFileSync(join(folder, "revision.txt"), "review");
      expect(await request(providers)).toMatchObject([
        { id: providerId, params: { revision: { defaultValue: "review" } } },
      ]);
      const workspace = await request("/workspaces", { project_id: project.id, provider_id: providerId, params: {} });
      expect(workspace).toMatchObject({ provider_state: "ready", execution_kind: "local", provider_error_json: null });
      expect(JSON.parse(readFileSync(join(workspace.root_path, "identity.json"), "utf8"))).toEqual({
        id: workspace.id,
        revision: "review",
      });
      await request(`/workspaces/${workspace.id}`, undefined, "DELETE");
      expect(existsSync(workspace.root_path)).toBe(false);
      expect(existsSync(folder)).toBe(true);
      writeFileSync(join(folder, "revision.txt"), "unavailable");
      expect(await request(providers)).toEqual([]);
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
