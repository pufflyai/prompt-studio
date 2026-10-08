import { beforeAll, expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

beforeAll(buildBinary, 180_000);

test("detects an npm-installed OpenCode command and lists its models", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-opencode-"));
  const prefix = join(root, "User Name & Tools", "AppData", "Roaming", "npm");
  const bin = join(prefix, "node_modules", "opencode-ai", "bin");
  const script = join(bin, "opencode.cjs");
  const commandLog = join(root, "opencode-commands.jsonl");
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    script,
    `require("node:fs").appendFileSync(${JSON.stringify(commandLog)}, JSON.stringify(process.argv.slice(2)) + "\\n");
console.log(process.argv[2] === "--version" ? "1.18.34" : "opencode/test-model");`,
  );
  if (process.platform === "win32") {
    const node = Bun.which("node");
    if (!node) throw new Error("Node.js is required to test npm command shims.");
    writeFileSync(
      join(prefix, "opencode.cmd"),
      `@ECHO off\r\n"${node}" "%~dp0\\node_modules\\opencode-ai\\bin\\opencode.cjs" %*\r\n`,
    );
    writeFileSync(join(prefix, "opencode.ps1"), 'throw "Use the sibling command shim"');
    writeFileSync(join(prefix, "opencode"), "#!/bin/sh\nexit 1\n");
  } else {
    writeFileSync(join(prefix, "opencode"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, {
      mode: 0o755,
    });
  }

  let child: ChildProcess | undefined;
  try {
    const started = await startPackagedServe(root, {
      PATH: `${prefix}${delimiter}${process.env.PATH}`,
      PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("harness-open-code"),
    });
    child = started.child;
    const headers = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
    const folder = join(root, "project");
    mkdirSync(folder);
    const created = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(folderProjectInput({ name: "OpenCode npm installation" }, folder)),
    });
    expect(created.status).toBe(201);
    const project = (await created.json()) as { id: string };
    const agents = await fetch(`${started.baseUrl}/v1/agents/info?project=${project.id}`, { headers });
    expect(agents.status).toBe(200);
    expect(await agents.json()).toEqual([
      expect.objectContaining({
        id: "pstdio.harness-open-code.harness.opencode",
        name: "OpenCode",
        availability: { type: "INSTALLED" },
      }),
    ]);
    const models = await fetch(
      `${started.baseUrl}/v1/agents/pstdio.harness-open-code.harness.opencode/models?project=${project.id}`,
      { headers },
    );
    expect(models.status).toBe(200);
    const commands = existsSync(commandLog) ? readFileSync(commandLog, "utf8") : "No OpenCode commands ran.";
    expect(await models.json(), `OpenCode command log:\n${commands}`).toEqual([
      expect.objectContaining({ id: "opencode/test-model" }),
    ]);
  } finally {
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
