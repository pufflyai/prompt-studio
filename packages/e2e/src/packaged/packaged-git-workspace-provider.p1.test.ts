import { expect, test } from "bun:test";
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { registerPendingTestProcess } from "../scripts/pending-test-processes";
import { waitForProcessReady } from "../scripts/process-readiness";
import { preparePackagedExtensionSource } from "./packaged-extension-source";
import { PACKAGED_BINARY_PATH, runPackagedAsync } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

test(
  "packaged Git provider installs independently, reopens the same checkout and removes only its owned files",
  async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "packaged-git-provider-")));
    let child: ChildProcess | undefined;
    try {
      const source = await preparePackagedExtensionSource(
        join(root, "source"),
        join(import.meta.dir, "../../../../extensions/git-workspaces"),
      );
      const projectFolder = join(root, "project");
      mkdirSync(projectFolder);
      const git = (...args: string[]) => execFileSync("git", args, { cwd: projectFolder, encoding: "utf8" }).trim();
      git("init", "-b", "main");
      git("config", "user.name", "Fixture");
      git("config", "user.email", "fixture@example.test");
      writeFileSync(join(projectFolder, "notes.txt"), "Retain the source project\n");
      git("add", ".");
      git("commit", "-m", "Initial project");
      let runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
      child = runtime.child;
      const request = async (path: string, body?: unknown, method = body === undefined ? "GET" : "POST") => {
        const response = await fetch(`${runtime.baseUrl}/v1${path}`, {
          method,
          headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const value = await response.json();
        expect(response.status, JSON.stringify(value)).toBeLessThan(300);
        return value;
      };
      const project = await request("/projects", folderProjectInput({ name: "Installed Git" }, projectFolder));
      const env = { PSTDIO_HOME: root, PSTDIO_API_URL: runtime.baseUrl, PSTDIO_API_TOKEN: runtime.descriptor.token };
      const dev = spawn(PACKAGED_BINARY_PATH, ["extensions", "dev", source, "--name", "git-workspaces"], {
        cwd: projectFolder,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      dev.stdout?.on("data", (chunk) => {
        output += chunk;
      });
      dev.stderr?.on("data", (chunk) => {
        output += chunk;
      });
      const lifetime = registerPendingTestProcess(dev);
      try {
        await waitForProcessReady(dev, "Git provider dev", async () =>
          output.includes(`watching ${source}`) ? true : undefined,
        );
        expect(output).toContain("validated pstdio.git-workspaces");
      } finally {
        try {
          await stopProcess(dev);
        } finally {
          lifetime.finish();
        }
      }
      await runPackagedAsync(["extensions", "add", source, "--force", "--name", "git-workspaces"], projectFolder, env);
      const installed = join(projectFolder, ".pstdio/extensions/git-workspaces");
      const dependency = realpathSync(join(installed, "node_modules/@pstdio/sdk"));
      expect(relative(join(installed, "node_modules"), dependency).startsWith("..")).toBe(false);
      renameSync(source, `${source}.unavailable`);
      expect(await request(`/projects/${project.id}/workspace-providers`)).toMatchObject([
        { id: "pstdio.worktree", params: { base: { defaultValue: "main" } } },
      ]);
      const workspace = await request("/workspaces", {
        project_id: project.id,
        provider_id: "pstdio.worktree",
        params: { base: "HEAD" },
      });
      expect(workspace).toMatchObject({ provider_state: "ready", execution_kind: "local" });
      expect(readFileSync(join(workspace.root_path, "notes.txt"), "utf8")).toBe("Retain the source project\n");
      await stopProcess(child);
      child = undefined;
      runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
      child = runtime.child;
      expect(await request(`/workspaces/${workspace.id}`)).toMatchObject({
        id: workspace.id,
        root_path: workspace.root_path,
        branch: workspace.branch,
        provider_ref_json: workspace.provider_ref_json,
      });
      await request(`/workspaces/${workspace.id}`, undefined, "DELETE");
      expect(existsSync(workspace.root_path)).toBe(false);
      expect(git("branch", "--list", workspace.branch)).toBe("");
      expect(readFileSync(join(projectFolder, "notes.txt"), "utf8")).toBe("Retain the source project\n");
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
