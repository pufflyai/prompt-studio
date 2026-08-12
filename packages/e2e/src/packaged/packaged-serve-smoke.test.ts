import { beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeExtensionInstallEnvironmentProbe, writeExtensionWithDependency } from "./extension-fixtures";
import { buildBinary } from "./packaged-helpers";

const BUILD_TIMEOUT = 180_000;
const SMOKE_TEST_TIMEOUT = 30_000;
// The macOS Intel release runner can spend over a minute extracting and loading all bundled core extensions.
const CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT = 120_000;
const REPO_ROOT = join(import.meta.dirname, "../../../..");
const BINARY_PATH = process.env.PSTDIO_PACKAGED_BINARY_PATH ?? join(REPO_ROOT, "dist/pstdio");
type RuntimeDescriptor = {
  pid: number;
  instanceId: string;
  ownerType: "desktop" | "persistent";
  origin: string;
  token: string;
  protocolVersion: number;
};

const runtimeAuthorization = (descriptor: RuntimeDescriptor) => ({
  authorization: `Bearer ${descriptor.token}`,
});

const waitForReady = async (descriptorPath: string, child: ChildProcess, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1_000);

    try {
      if (!existsSync(descriptorPath)) throw new Error("descriptor not published");
      const descriptor = JSON.parse(readFileSync(descriptorPath, "utf8")) as RuntimeDescriptor;
      const res = await fetch(`${descriptor.origin}/runtime/ready`, {
        headers: { authorization: `Bearer ${descriptor.token}` },
        signal: controller.signal,
      });
      const ready = res.ok ? ((await res.json()) as { instanceId: string; protocolVersion: number }) : null;
      if (
        descriptor.pid === child.pid &&
        descriptor.ownerType === "persistent" &&
        descriptor.origin.startsWith("http://127.0.0.1:") &&
        ready?.instanceId === descriptor.instanceId &&
        ready.protocolVersion === descriptor.protocolVersion
      ) {
        return descriptor;
      }
    } catch {
      // server not ready yet
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Packaged runtime did not become ready within ${timeoutMs}ms`);
};

const startPackagedServe = async (tempRoot: string, env: Record<string, string> = {}) => {
  const descriptorPath = join(tempRoot, "runtime.json");
  const child = spawn(
    BINARY_PATH,
    ["serve", "--foreground", "--owner", "persistent", "--host", "127.0.0.1", "--port", "0"],
    {
      // Run outside the repo root so runtime file access cannot rely on local workspace paths.
      cwd: tempRoot,
      env: {
        ...process.env,
        HOME: tempRoot,
        PSTDIO_HOME: tempRoot,
        PSTDIO_DB_PATH: join(tempRoot, "db.sqlite"),
        PSTDIO_DEFAULT_EXTENSIONS: "[]",
        PSTDIO_STORAGE_PATH: join(tempRoot, "storage"),
        ...env,
      },
      stdio: "pipe",
    },
  );

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  try {
    const descriptor = await waitForReady(descriptorPath, child);
    return { child, baseUrl: descriptor.origin, descriptor };
  } catch (error) {
    await stopProcess(child);
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${stderr}`.trim());
  }
};

const stopProcess = async (child: ChildProcess) => {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
};

beforeAll(() => {
  if (!process.env.PSTDIO_PACKAGED_BINARY_PATH) {
    buildBinary();
  }
}, BUILD_TIMEOUT);

describe("packaged pstdio — self-hosted serve", () => {
  test("includes the extension development command", () => {
    const result = spawnSync(BINARY_PATH, ["extensions", "dev", "--help"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("extensions dev <source>");
  });

  test(
    "serves the dashboard and API from the same origin",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;

      try {
        const started = await startPackagedServe(tempRoot);
        child = started.child;

        const dashboardRes = await fetch(started.baseUrl);
        expect(dashboardRes.status).toBe(200);
        expect(dashboardRes.headers.get("content-type")).toContain("text/html");

        const projectsRes = await fetch(`${started.baseUrl}/v1/projects`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(projectsRes.status).toBe(200);
      } finally {
        if (child) {
          await stopProcess(child);
        }
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    SMOKE_TEST_TIMEOUT,
  );

  test(
    "creates project without internal catalog seeds and with repo bootstrap artifacts",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;

      try {
        const started = await startPackagedServe(tempRoot);
        child = started.child;

        const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ name: "packaged-serve-project" }),
        });
        expect(createRes.status).toBe(201);

        const project = (await createRes.json()) as { id: string };
        const templatesRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/templates`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(templatesRes.status).toBe(200);

        const templates = (await templatesRes.json()) as { name: string }[];
        expect(templates).toEqual([]);

        const skillsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/skills`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(skillsRes.status).toBe(200);

        const skills = (await skillsRes.json()) as {
          name: string;
          files: { path: string; content: string; encoding: "utf8" }[];
        }[];
        expect(skills).toEqual([]);

        const repoPath = join(tempRoot, "repo");
        mkdirSync(repoPath, { recursive: true });

        const repoRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/repos`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ name: "repo", path: repoPath }),
        });
        expect(repoRes.status).toBe(201);

        expect(existsSync(join(repoPath, ".pstdio", "config.json"))).toBe(true);
      } finally {
        if (child) {
          await stopProcess(child);
        }
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    SMOKE_TEST_TIMEOUT,
  );

  test(
    "loads a default extension that imports an on-disk node_modules dependency",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;

      try {
        const extensionSource = writeExtensionWithDependency(tempRoot);
        const installEnvironmentProbe = writeExtensionInstallEnvironmentProbe(tempRoot);
        const started = await startPackagedServe(tempRoot, {
          PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
            { source: extensionSource, installName: "dep-ext", skipInstall: true },
            { source: installEnvironmentProbe, installName: "install-env-probe" },
          ]),
          HTTPS_PROXY: "http://127.0.0.1:9",
          NPM_CONFIG_REGISTRY: "http://127.0.0.1:9",
          NPM_TOKEN: "registry-secret",
          GITHUB_TOKEN: "source-control-secret",
          OPENAI_API_KEY: "provider-secret",
        });
        child = started.child;

        const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ name: "packaged-extension-project" }),
        });
        expect(createRes.status).toBe(201);

        const project = (await createRes.json()) as { id: string };
        const extensionsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(extensionsRes.status).toBe(200);

        const body = (await extensionsRes.json()) as {
          extensions: Array<{ enabled: boolean; installName: string; name: string }>;
        };
        const extension = body.extensions.find((entry) => entry.installName === "dep-ext");

        expect(extension).toMatchObject({
          enabled: true,
          name: "dep-ext",
        });

        expect(JSON.parse(readFileSync(join(tempRoot, "install-env.json"), "utf8"))).toEqual({
          httpsProxy: "http://127.0.0.1:9",
          npmRegistry: "http://127.0.0.1:9",
          npmToken: "registry-secret",
          sourceControlToken: null,
          providerKey: null,
        });
      } finally {
        if (child) {
          await stopProcess(child);
        }
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    SMOKE_TEST_TIMEOUT,
  );

  test(
    "loads packaged core default extensions",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;

      try {
        const started = await startPackagedServe(tempRoot, {
          PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
            defaultExtensions: [
              "harness-claude-code",
              "harness-codex",
              "harness-open-code",
              "pstdio-base-themes",
              "pstdio-planner",
              "pstdio-reports",
              "pstdio-skills",
            ],
          }),
        });
        child = started.child;

        const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ name: "packaged-core-extensions-project" }),
        });
        expect(createRes.status).toBe(201);

        const project = (await createRes.json()) as { id: string };
        const extensionsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(extensionsRes.status).toBe(200);

        const body = (await extensionsRes.json()) as {
          extensions: Array<{ enabled: boolean; installName: string; name: string }>;
        };

        expect(body.extensions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ enabled: true, installName: "harness-claude-code" }),
            expect.objectContaining({ enabled: true, installName: "harness-codex" }),
            expect.objectContaining({ enabled: true, installName: "harness-open-code" }),
            expect.objectContaining({ enabled: true, installName: "pstdio-base-themes" }),
            expect.objectContaining({ enabled: true, installName: "pstdio-planner" }),
            expect.objectContaining({ enabled: true, installName: "pstdio-reports" }),
            expect.objectContaining({ enabled: true, installName: "pstdio-skills" }),
          ]),
        );

        const runtimeRes = await fetch(`${started.baseUrl}/v1/extensions/runtime.js`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(runtimeRes.status).toBe(200);

        const runtimeScript = await runtimeRes.text();
        expect(runtimeScript).toContain("notification.action");
        expect(runtimeScript).toContain("notification.resolve");
        expect(runtimeScript).toContain("notification.dismiss");
        expect(runtimeScript).toContain("terminal.session");
      } finally {
        if (child) {
          await stopProcess(child);
        }
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT,
  );
});
