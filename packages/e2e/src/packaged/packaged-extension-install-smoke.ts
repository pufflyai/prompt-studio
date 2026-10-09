import { expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerExtensionInstallSmokeTests = () => {
  test("installs and checks extensions on the host despite a different CLI home", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "packaged-extension-install-")));
    let child: ChildProcess | undefined;
    try {
      const hostHome = join(root, "host-home");
      const cliHome = join(root, "cli-home");
      const repo = join(root, "repo");
      const source = join(root, "uploaded");
      for (const path of [hostHome, cliHome, repo, source]) mkdirSync(path);
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "uploaded",
          publisher: "test",
          version: "1.0.0",
          main: "./extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      writeFileSync(join(source, "extension.ts"), "export default {};");
      writeFileSync(join(source, ".gitignore"), "ignored.txt\n");
      writeFileSync(join(source, "ignored.txt"), "excluded");
      mkdirSync(join(source, "node_modules"));
      writeFileSync(join(source, "node_modules/ignored.txt"), "excluded");
      const host = await startPackagedServe(hostHome);
      child = host.child;
      const response = await fetch(`${host.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Upload Project" }, repo)),
      });
      expect(response.status).toBe(201);
      const project = (await response.json()) as { id: string };
      mkdirSync(join(repo, ".pstdio"), { recursive: true });
      writeFileSync(join(repo, ".pstdio/config.json"), JSON.stringify({ project_id: project.id }));
      const env = {
        ...process.env,
        PSTDIO_HOME: cliHome,
        PSTDIO_API_URL: host.baseUrl,
        PSTDIO_API_TOKEN: host.descriptor.token,
      };
      const installed = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "add", source, "--skip-install"], {
        cwd: repo,
        env,
        encoding: "utf8",
      });
      expect(installed.status).toBe(0);
      const target = join(hostHome, "extensions/uploaded");
      expect(installed.stdout).toContain(target);
      expect(existsSync(join(target, "package.json"))).toBe(true);
      expect(existsSync(join(target, "ignored.txt"))).toBe(false);
      expect(existsSync(join(target, "node_modules"))).toBe(false);
      expect(existsSync(join(cliHome, "extensions"))).toBe(false);
      const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
      manifest.dependencies = { demo: "file:./vendor/demo" };
      writeFileSync(join(source, "package.json"), JSON.stringify(manifest));
      mkdirSync(join(source, "vendor/demo"), { recursive: true });
      writeFileSync(
        join(source, "vendor/demo/package.json"),
        JSON.stringify({ name: "demo", version: "1.0.0", main: "index.ts" }),
      );
      writeFileSync(join(source, "vendor/demo/index.ts"), 'export default "Packaged dependency";');
      writeFileSync(
        join(source, "extension.ts"),
        'import title from "demo"; export default {commands:[{id:"hello",ref:{kind:"command",id:"hello"},title,run(){return title;}}]};',
      );
      const replaced = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "add", source, "--force"], {
        cwd: repo,
        env,
        encoding: "utf8",
      });
      expect(replaced.status).toBe(0);
      rmSync(source, { recursive: true });
      expect(readFileSync(join(target, "node_modules/demo/index.ts"), "utf8")).toContain("Packaged dependency");
      expect(existsSync(join(target, "node_modules/ignored.txt"))).toBe(false);
      const checked = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "check", "--scope", "user", "--json"], {
        cwd: repo,
        env,
        encoding: "utf8",
      });
      expect(checked.status).toBe(0);
      const body = JSON.parse(checked.stdout);
      expect(body.checks[0].extensionsRoot).toBe(join(hostHome, "extensions"));
      expect(body.checks[0].extensions.some((entry: { id: string }) => entry.id === "test.uploaded")).toBe(true);
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  });
};
