// Records real Codex app-server traffic for the supported-version replay tests.
// Usage: bun scripts/record-cli-output.ts <codex executable>
// Requires a signed-in Codex. Rerun at the minimum and latest versions when the minimum changes.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import type { JsonPatch } from "@pstdio/sdk/extensions";
import { defaultSpawnProcess } from "../src/codex-process";
import { createCodexRuntime } from "../src/codex-runtime";

const executable = resolve(process.argv[2] ?? "codex");
const version = spawnSync(executable, ["--version"], { encoding: "utf8" }).stdout.match(/\d+\.\d+\.\d+/)?.[0];
if (!version) throw new Error(`${executable} did not report a version.`);
process.env.PATH = `${dirname(executable)}${delimiter}${process.env.PATH}`;

const codexHome = realpathSync(mkdtempSync(join(tmpdir(), "codex-record-home-")));
const auth = join(homedir(), ".codex", "auth.json");
if (existsSync(auth)) symlinkSync(auth, join(codexHome, "auth.json"));
const cwd = realpathSync(mkdtempSync(join(tmpdir(), "codex-record-")));
const env = { CODEX_HOME: codexHome, PSTDIO_SESSION_ID: "record" };

const traffic: Array<{ direction: "sent" | "received"; message: unknown }> = [];
const runtime = createCodexRuntime({
  spawnProcess: (args, options) => {
    const child = defaultSpawnProcess(args, options);
    let buffer = "";
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) traffic.push({ direction: "received", message: JSON.parse(line) });
    });
    const write = child.stdin.write.bind(child.stdin);
    child.stdin.write = ((chunk: string, ...rest: unknown[]) => {
      traffic.push({ direction: "sent", message: JSON.parse(chunk) });
      return (write as (...args: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof child.stdin.write;
    return child;
  },
});

const events = { getMessages: () => [], push: (_patch: JsonPatch) => {} };
const session = await runtime.run({
  prompt: "Run the shell command `sleep 2 && echo hi` and then reply with the single word done.",
  events,
  cwd,
  env,
  params: { model_reasoning_effort: "low" },
});
await session.done;
await runtime.readMessages({ agentSessionId: session.agentSessionId, cwd, env });
await runtime.dispose();

// Never keep machine paths or account details in the recording. The harness reads neither notification.
const privateMethods = new Set(["remoteControl/status/changed", "account/updated", "account/rateLimits/updated"]);
const kept = traffic.filter((entry) => !privateMethods.has((entry.message as { method?: string }).method ?? ""));
const scrubbed = kept.map((entry) =>
  JSON.stringify(entry)
    .replaceAll(codexHome, "/codex-home")
    .replaceAll(cwd, "/workspace")
    .replaceAll(homedir(), "/home/user"),
);
const output = resolve(import.meta.dirname, `../src/mocks/recorded/${version}-shell-turn.jsonl`);
writeFileSync(output, `${scrubbed.join("\n")}\n`);
console.log(`Recorded Codex ${version} traffic in ${output}`);
