import { beforeAll, expect, test } from "bun:test";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeSmokeExtension } from "./extension-smoke-fixtures";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";

beforeAll(buildBinary, 180_000);
for (const [behavior, code] of [
  ["pass", 0],
  ["throw", 1],
  ["denied", 1],
  ["commands", 0],
  ["invalid", 2],
  ["malformed", 2],
  ["repo", 0],
] as const) {
  test(`packaged extension smoke reports ${behavior} outside the checkout`, () => {
    const root = mkdtempSync(join(tmpdir(), "extension-smoke-consumer-"));
    let retained: string | undefined;
    try {
      const source = writeSmokeExtension(root, behavior);
      const original = readFileSync(join(source, "package.json"), "utf8");
      const run = spawnSync(
        PACKAGED_BINARY_PATH,
        [
          "extensions",
          "test",
          source,
          "--json",
          "--keep-home",
          ...(behavior === "repo" ? ["--project-path", root] : []),
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            PSTDIO_HOME: join(root, "caller-home"),
            PSTDIO_API_URL: "http://127.0.0.1:1",
            PSTDIO_PROJECT_ID: "caller",
            PSTDIO_DEFAULT_EXTENSIONS: '["must-not-load"]',
          },
          encoding: "utf8",
          timeout: 29_000,
        },
      );
      expect(existsSync(join(root, "caller-home"))).toBe(false);
      const result = JSON.parse(run.stdout);
      retained = result.evidence?.directory;
      expect({ code: run.status, result }).toMatchObject({ code, result: { exitCode: code } });
      expect(readFileSync(join(source, "package.json"), "utf8")).toBe(original);
      expect(existsSync(join(source, "bun.lock"))).toBe(false);
      expect(existsSync(join(source, "node_modules"))).toBe(false);
      if (behavior === "pass") {
        expect(result.coverage.visited).toContain("test.smoke.page.overview");
        expect(result.browser.name).toBe("chromium");
      }
      if (behavior === "commands") expect(result.coverage.visited).toEqual([]);
      if (behavior === "denied")
        expect(result.checks).toContainEqual(
          expect.objectContaining({ code: "undeclared_webview_capability", capability: "notification.show" }),
        );
      if (retained) expect(existsSync(join(retained, "home/runtime.json"))).toBe(false);
    } finally {
      if (retained) rmSync(retained, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
}

test("missing Chromium produces a setup result without changing source", () => {
  const root = mkdtempSync(join(tmpdir(), "extension-smoke-browser-"));
  try {
    const source = writeSmokeExtension(root);
    const run = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "test", source, "--json"], {
      cwd: root,
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join(root, "missing-browser") },
      encoding: "utf8",
    });
    expect(run.status).toBe(3);
    const result = JSON.parse(run.stdout);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        status: "failed",
        id: "setup",
        message: expect.stringContaining("bunx playwright@1.60.0 install chromium --with-deps"),
      }),
    );
    expect(existsSync(join(source, "bun.lock"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("interruption stops the browser and host while retaining requested evidence", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-smoke-signal-"));
  const source = writeSmokeExtension(root);
  const child = spawn(PACKAGED_BINARY_PATH, ["extensions", "test", source, "--json", "--keep-home"], {
    cwd: root,
    env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = once(child, "exit");
  child.stdout.resume();
  try {
    await new Promise<void>((resolve, reject) => {
      let output = "";
      child.stderr.on("data", (data) => {
        output += data.toString();
        if (output.includes("Extension smoke: dashboard")) resolve();
      });
      child.once("error", reject);
      child.once("exit", () => reject(new Error("Smoke process exited before browser startup")));
    });
    const retained = join(root, readdirSync(root).find((name) => name.startsWith("pstdio-extension-test-"))!);
    const descriptor = JSON.parse(readFileSync(join(retained, "home/runtime.json"), "utf8"));
    child.kill("SIGTERM");
    const [, signal] = await exited;
    expect(signal).toBe("SIGTERM");
    expect(() => process.kill(descriptor.pid, 0)).toThrow();
    expect(existsSync(join(retained, "browser-profile"))).toBe(true);
    expect(existsSync(join(retained, "home/runtime.json"))).toBe(false);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await exited;
    }
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);

test("a successful run removes disposable disk state by default", () => {
  const root = mkdtempSync(join(tmpdir(), "extension-smoke-cleanup-"));
  try {
    const source = writeSmokeExtension(root, "commands");
    const run = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "test", source, "--json"], {
      cwd: root,
      env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root },
      encoding: "utf8",
      timeout: 29_000,
    });
    expect({ code: run.status, result: JSON.parse(run.stdout) }).toMatchObject({ code: 0 });
    expect(readdirSync(root).filter((name) => name.startsWith("pstdio-extension-test-"))).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
