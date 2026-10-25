import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import type { TerminalWebSocketServerMessage } from "pstdio-api-contracts";
import { logTestPhase } from "../scripts/log-test-phase";
import { runTestCommand } from "../scripts/run-test-command";
import { writeSmokeExtension } from "./extension-smoke-fixtures";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const browserHome = mkdtempSync(join(tmpdir(), "extension-smoke-browser-home-"));
const smokeEnv = { ...process.env, PSTDIO_HOME: browserHome };
beforeAll(async () => {
  buildBinary();
  logTestPhase("prepare extension smoke browser");
  const setup = await runTestCommand(PACKAGED_BINARY_PATH, ["extensions", "install-browser"], {
    env: smokeEnv,
  });
  expect({ code: setup.status, output: setup.stderr }).toMatchObject({ code: 0 });
}, 180_000);
afterAll(() => rmSync(browserHome, { recursive: true, force: true }));
for (const [behavior, code] of [
  ["pass", 0],
  ["throw", 1],
  ["denied", 1],
  ["commands", 0],
  ["invalid", 2],
  ["malformed", 2],
  ["repo", 0],
  ["environment", 0],
  ["forged-diagnostic", 0],
  ["panels", 0],
  ["empty-panels", 0],
] as const) {
  test(`packaged extension smoke reports ${behavior} outside the checkout`, async () => {
    const root = mkdtempSync(join(tmpdir(), "extension-smoke-consumer-"));
    let retained: string | undefined;
    try {
      const source = writeSmokeExtension(root, behavior);
      const original = readFileSync(join(source, "package.json"), "utf8");
      logTestPhase(`run packaged extension smoke: ${behavior}`);
      const run = await runTestCommand(
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
            ...smokeEnv,
            PSTDIO_API_URL: "http://127.0.0.1:1",
            PSTDIO_PROJECT_ID: "caller",
            PSTDIO_DEFAULT_EXTENSIONS: '["must-not-load"]',
            SMOKE_TEST_CALLER_SECRET: "caller-secret",
          },
        },
        code,
      );
      expect(existsSync(join(browserHome, "runtime.json"))).toBe(false);
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
      if (behavior === "panels") {
        // Only the active main tab mounts; the inactive fixed panel must be reported, not passed.
        const panels = ["test.smoke.view.overview", "test.smoke.view.details"];
        const unexercised = result.coverage.unexercised.map((item: { contributionId: string }) => item.contributionId);
        expect(panels.filter((id) => result.coverage.visited.includes(id))).toHaveLength(1);
        expect(panels.filter((id) => unexercised.includes(id))).toHaveLength(1);
        expect(result.coverage.visited).not.toContain("test.smoke.view.empty");
      }
      if (behavior === "empty-panels") expect(result.coverage.visited).toContain("test.smoke.view.empty");
      if (behavior === "denied")
        expect(result.checks).toContainEqual(
          expect.objectContaining({ code: "undeclared_webview_capability", capability: "notification.show" }),
        );
      if (code !== 2) {
        expect(retained).toBeString();
        expect(existsSync(join(retained!, "home/runtime.json"))).toBe(false);
      }
    } finally {
      if (retained) rmSync(retained, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
}

test("missing Chromium produces a setup result without changing source", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-smoke-browser-"));
  try {
    const source = writeSmokeExtension(root);
    logTestPhase("run extension smoke without Chromium");
    const run = await runTestCommand(
      PACKAGED_BINARY_PATH,
      ["extensions", "test", source, "--json"],
      {
        cwd: root,
        env: { ...smokeEnv, PLAYWRIGHT_BROWSERS_PATH: join(root, "missing-browser") },
      },
      3,
    );
    expect(run.status).toBe(3);
    const result = JSON.parse(run.stdout);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        status: "failed",
        id: "setup",
        phase: "setup",
        message: expect.stringContaining("pst extensions install-browser"),
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
  const held = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const gate = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      held.resolve();
      await release.promise;
      return new Response(null, { headers: { "access-control-allow-origin": "*" } });
    },
  });
  try {
    writeFileSync(
      join(source, "view.ts"),
      `export default {async mount(mount) {await fetch(${JSON.stringify(gate.url.href)}); mount.textContent="Released"; return ()=>{};}};`,
    );
    const controlHome = join(root, "control");
    mkdirSync(controlHome);
    const control = await startPackagedServe(controlHome);
    const url = new URL("/v1/terminal", control.baseUrl);
    url.protocol = "ws:";
    const terminal = new WebSocket(url, { headers: runtimeAuthorization(control.descriptor) });
    logTestPhase("launch interruptible extension smoke");
    let output = "";
    const exited = Promise.withResolvers<Extract<TerminalWebSocketServerMessage, { type: "exit" }>>();
    terminal.onopen = () =>
      terminal.send(
        JSON.stringify({
          type: "open",
          request: {
            command: [PACKAGED_BINARY_PATH, "extensions", "test", source, "--json", "--keep-home"],
            cwd: root,
            env: { ...smokeEnv, TMPDIR: root, TMP: root, TEMP: root },
            cols: 200,
            rows: 40,
          },
        }),
      );
    terminal.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as TerminalWebSocketServerMessage;
      if (message.type === "data") output += Buffer.from(message.chunk, "base64").toString();
      if (message.type === "error") exited.reject(new Error(message.message));
      if (message.type === "exit") exited.resolve(message);
    };
    terminal.onerror = () => exited.reject(new Error("Extension smoke terminal failed"));
    terminal.onclose = () => exited.reject(new Error("Extension smoke terminal closed before process exit"));
    try {
      await Promise.race([
        held.promise,
        exited.promise.then(() => {
          throw new Error(`Smoke process exited before reaching the held webview: ${output}`);
        }),
      ]);
      logTestPhase("interrupt held extension webview");
      const retained = join(root, readdirSync(root).find((name) => name.startsWith("pstdio-extension-test-"))!);
      const descriptor = JSON.parse(readFileSync(join(retained, "home/runtime.json"), "utf8"));
      // Drive a real Ctrl+C through the host terminal on every platform. On Windows,
      // child.kill("SIGTERM") force-terminates a process without running its signal handler.
      terminal.send(JSON.stringify({ type: "write", data: Buffer.from("\u0003").toString("base64") }));
      const message = await exited.promise;
      expect({ code: message.code, output }).toMatchObject({ code: 130 });
      expect(() => process.kill(descriptor.pid, 0)).toThrow();
      expect(existsSync(join(retained, "browser-profile"))).toBe(true);
      expect(existsSync(join(retained, "home/runtime.json"))).toBe(false);
      const browser = await chromium.launchPersistentContext(join(retained, "browser-profile"), PROVISIONED_CHROMIUM);
      await browser.close();
    } finally {
      if (process.env.NATIVE_PROFILE_LOG) writeFileSync(`${process.env.NATIVE_PROFILE_LOG}.terminal`, output);
      terminal.onopen = null;
      terminal.onmessage = null;
      terminal.onerror = null;
      terminal.onclose = null;
      terminal.close();
      await stopProcess(control.child);
    }
  } finally {
    release.resolve();
    await gate.stop(true);
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);

test("a successful run removes disposable disk state by default", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-smoke-cleanup-"));
  try {
    const source = writeSmokeExtension(root, "commands");
    logTestPhase("run disposable extension smoke");
    const run = await runTestCommand(PACKAGED_BINARY_PATH, ["extensions", "test", source, "--json"], {
      cwd: root,
      env: { ...smokeEnv, TMPDIR: root, TMP: root, TEMP: root },
    });
    expect({ code: run.status, result: JSON.parse(run.stdout) }).toMatchObject({ code: 0 });
    expect(readdirSync(root).filter((name) => name.startsWith("pstdio-extension-test-"))).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
