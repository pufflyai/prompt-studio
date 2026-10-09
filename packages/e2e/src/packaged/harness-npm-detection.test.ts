import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
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

const installFixtures = (prefix: string, broken: boolean) => {
  for (const harness of harnesses) {
    const bin = join(prefix, "node_modules", harness.command, "bin");
    mkdirSync(bin, { recursive: true });
    const script = join(bin, "cli.cjs");
    let source = `console.error(${JSON.stringify(harness.version)});`;
    if (harness.command === "opencode")
      source = broken
        ? "setInterval(() => {}, 1000);"
        : `console.log(process.argv[2] === '--version' ? ${JSON.stringify(harness.version)} : 'opencode/test-model');`;
    if (broken && harness.command === "codex") source = "console.error('broken install'); process.exit(7);";
    writeFileSync(script, source);
    if (process.platform === "win32") {
      const node = Bun.which("node");
      if (!node) throw new Error("Node.js is required to test npm command shims.");
      writeFileSync(
        join(prefix, `${harness.command}.cmd`),
        `@ECHO off\r\n"${node}" "%~dp0\\node_modules\\${harness.command}\\bin\\cli.cjs" %*\r\n`,
      );
      writeFileSync(join(prefix, `${harness.command}.ps1`), 'throw "Use the sibling command shim"');
      writeFileSync(join(prefix, harness.command), "#!/bin/sh\nexit 1\n");
    } else {
      writeFileSync(join(prefix, harness.command), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, {
        mode: 0o755,
      });
    }
  }
};

const root = mkdtempSync(join(tmpdir(), "packaged-harness-discovery-"));
const prefix = join(root, "User Å Name & Tools", "custom-prefix");
let runtime: Awaited<ReturnType<typeof startPackagedServe>>;

// Both projects use one runtime: changing the CLI fixtures also proves discovery
// observes the current installation instead of caching a previous success.
beforeAll(async () => {
  installFixtures(prefix, false);
  runtime = await startPackagedServe(root, {
    PATH: `${prefix}${delimiter}${process.env.PATH}`,
    PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions(...harnesses.map((harness) => harness.extension)),
  });
}, 30_000);

afterAll(async () => {
  if (runtime) await stopProcess(runtime.child);
  rmSync(root, { recursive: true, force: true });
});

for (const broken of [false, true]) {
  test(broken
    ? "lists healthy harnesses beside failed and hanging npm probes"
    : "detects all npm harnesses from a custom prefix", async () => {
    installFixtures(prefix, broken);
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
    const project = await createProject(broken ? "broken-harnesses" : "healthy-harnesses");
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
