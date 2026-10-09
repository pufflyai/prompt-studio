import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import cmdShim from "cmd-shim";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

beforeAll(buildBinary, 180_000);

const harnesses = [
  { command: "opencode", extension: "harness-open-code", id: "opencode", version: "1.18.34" },
  { command: "codex", extension: "harness-codex", id: "codex", version: "codex-cli 0.160.1" },
  { command: "claude", extension: "harness-claude-code", id: "claude-code", version: "2.1.0 (Claude Code)" },
];
const harnessId = (harness: (typeof harnesses)[number]) => `pstdio.${harness.extension}.harness.${harness.id}`;

const installFixtures = async (prefix: string, state: "healthy" | "broken" | "hanging") => {
  for (const harness of harnesses) {
    const bin = join(prefix, "node_modules", harness.command, "bin");
    mkdirSync(bin, { recursive: true });
    const script = join(bin, "cli.cjs");
    let source = `console.error(${JSON.stringify(`\u001b[32m${harness.version}\u001b[0m`)});`;
    if (harness.command === "opencode")
      source =
        state === "broken"
          ? `require('node:fs').writeFileSync(${JSON.stringify(join(prefix, "opencode.pid"))}, String(process.pid)); setInterval(() => {}, 1000);`
          : `console.log(process.argv[2] === '--version' ? ${JSON.stringify(harness.version)} : 'opencode/test-model');`;
    if (state === "broken" && harness.command === "codex") source = "console.error('broken install'); process.exit(7);";
    if (state === "hanging")
      source = `require('node:fs').writeFileSync(${JSON.stringify(join(prefix, `${harness.command}.pid`))}, String(process.pid)); setInterval(() => {}, 1000);`;
    writeFileSync(script, `#!/usr/bin/env node\n${source}`);
    if (process.platform === "win32") {
      await cmdShim(script, join(prefix, harness.command));
    } else {
      writeFileSync(join(prefix, harness.command), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, {
        mode: 0o755,
      });
    }
  }
};

const root = mkdtempSync(join(tmpdir(), "packaged-harness-discovery-"));
const prefix = join(root, "User Å Name Tools", "custom-prefix");
let runtime: Awaited<ReturnType<typeof startPackagedServe>>;
let project: { id: string };

beforeAll(async () => {
  await installFixtures(prefix, "healthy");
  runtime = await startPackagedServe(root, {
    PATH: `${prefix}${delimiter}${process.env.PATH}`,
    PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions(...harnesses.map((harness) => harness.extension)),
  });
}, 30_000);

afterAll(async () => {
  if (runtime) await stopProcess(runtime.child);
  rmSync(root, { recursive: true, force: true });
});

const expectProbeExited = async (command: string) => {
  const pid = Number(await Bun.file(join(prefix, `${command}.pid`)).text());
  expect(pid).toBeGreaterThan(0);
  // A timeout response can arrive just before the OS finishes stopping the child.
  // Keep the runtime alive and still require the child to exit within one second.
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await Bun.sleep(20);
  }
  throw new Error(`Version probe ${command} is still alive after its deadline.`);
};

for (const broken of [false, true]) {
  test(broken
    ? "refreshes the same project and lists healthy harnesses beside failed and hanging npm probes"
    : "detects all npm harnesses from a custom prefix", async () => {
    await installFixtures(prefix, broken ? "broken" : "healthy");
    const started = runtime;
    const headers = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
    const createProject = async (name: string, agents?: string[]) => {
      const folder = join(root, name);
      mkdirSync(folder);
      const created = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers,
        body: JSON.stringify(folderProjectInput({ name, ...(agents ? { agents } : {}) }, folder)),
      });
      expect(created.status).toBe(201);
      return (await created.json()) as { id: string };
    };
    if (!broken) project = await createProject("harnesses");
    // Reuse the same cache key and let the five-second availability TTL expire.
    if (broken) await Bun.sleep(5_001);
    const agents = await fetch(`${started.baseUrl}/v1/agents/info?project=${project.id}`, { headers });
    expect(agents.status).toBe(200);
    const result = (await agents.json()) as Array<{ id: string; availability: { type: string } }>;
    expect(result).toHaveLength(3);
    for (const harness of harnesses) {
      expect(result).toContainEqual(
        expect.objectContaining({
          id: harnessId(harness),
          availability: { type: broken && harness.command !== "claude" ? "NOT_FOUND" : "INSTALLED" },
        }),
      );
    }
    if (broken) {
      await expectProbeExited("opencode");
    }
    if (!broken) {
      const models = await fetch(
        `${started.baseUrl}/v1/agents/${harnessId(harnesses[0])}/models?project=${project.id}`,
        { headers },
      );
      expect(models.status).toBe(200);
      expect(await models.json()).toEqual([expect.objectContaining({ id: "opencode/test-model" })]);
      const selected = await createProject("selected", [harnessId(harnesses[0])]);
      const scoped = await fetch(`${started.baseUrl}/v1/agents/info?project=${selected.id}`, { headers });
      expect(((await scoped.json()) as Array<{ id: string }>).map(({ id }) => id)).toEqual([harnessId(harnesses[0])]);
    }
  }, 30_000);
}

test("returns no models and stops every hanging version probe", async () => {
  for (const harness of harnesses) rmSync(join(prefix, `${harness.command}.pid`), { force: true });
  await installFixtures(prefix, "hanging");
  const headers = runtimeAuthorization(runtime.descriptor);
  try {
    const results = await Promise.allSettled(
      harnesses.map(async (harness) => {
        const response = await fetch(
          `${runtime.baseUrl}/v1/agents/${harnessId(harness)}/models?project=${project.id}`,
          { headers, signal: AbortSignal.timeout(4_000) },
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([]);
      }),
    );
    for (const result of results)
      expect(result.status, result.status === "rejected" ? String(result.reason) : undefined).toBe("fulfilled");
    await Promise.all(harnesses.map((harness) => expectProbeExited(harness.command)));
  } finally {
    // A failing regression must not leave fixtures alive after the test runtime exits.
    for (const harness of harnesses) {
      const file = Bun.file(join(prefix, `${harness.command}.pid`));
      if (!(await file.exists())) continue;
      try {
        process.kill(Number(await file.text()), "SIGKILL");
      } catch {}
    }
  }
}, 30_000);
