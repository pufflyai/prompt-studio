import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createGitRepo, createProjectViaApi } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

const runnerPath = join(import.meta.dirname, "run-pstdio.ts");
const repoRoot = join(import.meta.dirname, "../../../..");

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: "[]", PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1" } });
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

const writeExtension = (extensionRoot: string, input: { dependency?: boolean; command?: boolean } = {}) => {
  const dependencies = input.dependency ? { "missing-dev-dependency": "file:./missing-dev-dependency" } : {};
  writeFileSync(
    join(extensionRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "dev-smoke",
        version: "1.0.0",
        displayName: "Dev Smoke",
        publisher: "pstdio",
        main: "./extension.ts",
        engines: { pstdio: EXTENSION_API_VERSION },
        dependencies,
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
  const dependencyImport = input.dependency ? 'import "missing-dev-dependency";\n' : "";
  const command = input.command
    ? '{ id: "ping", ref: { id: "ping", kind: "command" }, title: "Ping", run: async () => ({ ok: true }) }'
    : "";
  writeFileSync(join(extensionRoot, "extension.ts"), `${dependencyImport}export default { commands: [${command}] };\n`);
};

const startDev = (repo: string, extensionRoot: string) => {
  const child = spawn("bun", ["run", runnerPath, "extensions", "dev", extensionRoot, "--name", "dev-smoke"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PSTDIO_API_URL: api.url,
      PSTDIO_DEFAULT_EXTENSIONS: "[]",
      PSTDIO_DISABLE_API_AUTO_START: "1",
      PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      PSTDIO_E2E_CWD: repo,
      PSTDIO_HOME: api.homePath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  return { child, stderr: () => stderr, stdout: () => stdout };
};

const waitFor = async (predicate: () => boolean | Promise<boolean>, child: ChildProcess, output: () => string) => {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Extension dev exited early.\n${output()}`);
    }
    await Bun.sleep(50);
  }
  throw new Error(`Timed out waiting for extension dev.\n${output()}`);
};

const stop = async (child: ChildProcess) => {
  if (child.exitCode !== null || child.signalCode !== null) return child.exitCode;
  const exited = new Promise<number | null>((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  return exited;
};

const extensionState = async (projectId: string) => {
  const response = await fetch(`${api.url}/v1/projects/${projectId}/extensions`);
  expect(response.ok).toBe(true);
  const body = (await response.json()) as {
    extensions: Array<{ installName: string; sourcePath: string; status: string }>;
  };
  return body.extensions.find((extension) => extension.installName === "dev-smoke");
};

describe("extensions dev", () => {
  test(
    "refreshes edits and recovers after a dependency install failure",
    async () => {
      const repo = createGitRepo();
      const extensionRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-dev-e2e-"));
      const project = await createProjectViaApi(api.url, "Extension dev e2e");
      mkdirSync(join(repo, ".pstdio"), { recursive: true });
      writeFileSync(join(repo, ".pstdio", "config.json"), JSON.stringify({ project_id: project.id }));
      writeExtension(extensionRoot);
      const dev = startDev(repo, extensionRoot);

      try {
        await waitFor(
          () => dev.stdout().includes(`watching ${extensionRoot}`),
          dev.child,
          () => dev.stderr(),
        );
        await waitFor(
          async () => Boolean(await extensionState(project.id)),
          dev.child,
          () => `${dev.stdout()}\n${dev.stderr()}`,
        );
        expect(await extensionState(project.id)).toMatchObject({ status: "loaded" });

        writeExtension(extensionRoot, { command: true });
        await waitFor(() => dev.stdout().includes("registered pstdio.dev-smoke.command.ping"), dev.child, dev.stdout);

        writeExtension(extensionRoot, { command: true, dependency: true });
        await waitFor(() => dev.stderr().includes("Dependency install failed"), dev.child, dev.stderr);
        const failedState = await extensionState(project.id);
        expect(failedState?.status).toBe("loaded");
        expect(readFileSync(join(failedState!.sourcePath, "extension.ts"), "utf8")).not.toContain(
          "missing-dev-dependency",
        );

        const dependencyRoot = join(extensionRoot, "missing-dev-dependency");
        mkdirSync(dependencyRoot, { recursive: true });
        writeFileSync(
          join(dependencyRoot, "package.json"),
          JSON.stringify({ name: "missing-dev-dependency", version: "1.0.0", main: "./index.js" }),
        );
        writeFileSync(join(dependencyRoot, "index.js"), "export {};\n");

        await waitFor(
          () => {
            const sourcePath = failedState?.sourcePath;
            return Boolean(
              sourcePath && readFileSync(join(sourcePath, "extension.ts"), "utf8").includes("missing-dev-dependency"),
            );
          },
          dev.child,
          () => `${dev.stdout()}\n${dev.stderr()}`,
        );
        expect(await extensionState(project.id)).toMatchObject({ status: "loaded" });
        expect(await stop(dev.child)).toBe(0);
      } finally {
        await stop(dev.child);
        rmSync(repo, { recursive: true, force: true });
        rmSync(extensionRoot, { recursive: true, force: true });
      }
    },
    TEST_TIMEOUT,
  );
});
