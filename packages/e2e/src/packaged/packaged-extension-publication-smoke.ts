import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

export const registerExtensionPublicationSmokeTests = () => {
  test(
    "compiled CLI publishes immutable packages, shares enable state and adopts a complete revision",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "packaged-extension-publication-"));
      const home = join(root, "home");
      const repo = join(root, "repo");
      const source = join(root, "source");
      for (const path of [home, repo, source]) mkdirSync(path);
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "unrelated",
          publisher: "example",
          version: "1.0.0",
          main: "extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      writeFileSync(join(source, "extension.ts"), "export default {};");
      const host = await startPackagedServe(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
      try {
        const response = await fetch(`${host.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
          body: JSON.stringify(folderProjectInput({ name: "Publication" }, repo)),
        });
        expect(response.status).toBe(201);
        const project = (await response.json()) as { id: string };
        mkdirSync(join(repo, ".pstdio"), { recursive: true });
        writeFileSync(join(repo, ".pstdio", "config.json"), JSON.stringify({ project_id: project.id }));
        const run = (...args: string[]) => {
          const result = spawnSync(PACKAGED_BINARY_PATH, args, {
            cwd: repo,
            env: {
              ...process.env,
              PSTDIO_HOME: home,
              PSTDIO_API_URL: host.baseUrl,
              PSTDIO_API_TOKEN: host.descriptor.token,
            },
            encoding: "utf8",
          });
          if (result.status !== 0) throw new Error(result.stderr || result.stdout);
          return result.stdout;
        };
        run("extensions", "add", source, "--name", "unrelated", "--skip-install");
        expect(JSON.parse(run("extensions", "publication", "list"))[0].value).toBe(null);
        expect(JSON.parse(run("extensions", "publication", "publish", "unrelated")).status).toBe("saved-locally");
        const saved = JSON.parse(run("extensions", "publication", "list"))[0];
        expect(saved.value.revision).toBe(saved.asset.sha256);
        expect(saved.value.version).toBe("1.0.0");
        const headers = runtimeAuthorization(host.descriptor);
        const url = `${host.baseUrl}/v1/projects/${project.id}/extensions`;
        const previous = (
          (await (await fetch(url, { headers })).json()) as { extensions: { id: string; sourcePath: string }[] }
        ).extensions[0]!;
        expect(JSON.parse(run("extensions", "publication", "adopt", "example.unrelated")).status).toBe("active");
        const active = (
          (await (await fetch(url, { headers })).json()) as { extensions: { id: string; sourcePath: string }[] }
        ).extensions[0]!;
        expect(active.id).toBe(previous.id);
        expect(active.sourcePath).not.toBe(source);
        run("extensions", "publication", "disable", "example.unrelated");
        expect(JSON.parse(run("extensions", "publication", "list"))[0].value.enabled).toBe(false);
      } finally {
        await stopProcess(host.child);
        rmSync(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
};
