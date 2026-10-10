// Records the session messages of a real OpenCode turn for the supported-version replay tests.
// Usage: bun scripts/record-cli-output.ts <opencode executable>
// Uses a free OpenCode model, so no login is needed. Rerun at the minimum and latest versions when the
// minimum changes.
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "../src/harness";

const executable = resolve(process.argv[2] ?? "opencode");
const version = spawnSync(executable, ["--version"], { encoding: "utf8" }).stdout.match(/\d+\.\d+\.\d+/)?.[0];
if (!version) throw new Error(`${executable} did not report a version.`);
process.env.PATH = `${dirname(executable)}${delimiter}${process.env.PATH}`;
// Keep the recording out of the recorder's own OpenCode data.
const home = realpathSync(mkdtempSync(join(tmpdir(), "opencode-record-home-")));
for (const dir of ["DATA", "CONFIG", "STATE", "CACHE"]) process.env[`XDG_${dir}_HOME`] = join(home, dir.toLowerCase());
const cwd = realpathSync(mkdtempSync(join(tmpdir(), "opencode-record-")));

let lastMessages = "[]";
const fetcher: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const url = new URL(String(input));
  if ((init?.method ?? "GET") === "GET" && /\/session\/[^/]+\/message$/.test(url.pathname))
    lastMessages = await response.clone().text();
  return response;
};
const values = new Map<string, unknown>();
const context = {
  process: { run: async () => ({ exitCode: 0, stdout: "", stderr: "" }) },
  state: {
    get: async (key: string) => values.get(key),
    set: async (key: string, value: unknown) => void values.set(key, value),
    delete: async (key: string) => void values.delete(key),
  },
  logger: { warn: console.warn, info: () => {}, error: console.error },
} as unknown as HarnessContext;

const harness = createOpencodeHarness({}, { fetcher });
const session = await harness.start(context, {
  prompt: "Run the shell command `echo hi` with your bash tool, then reply with only the word done.",
  model: "opencode/big-pickle",
  cwd,
  sessionId: "record",
  events: { getMessages: () => [], push: () => {} },
});
const exit = await session.done;
if (exit.status !== "completed") throw new Error(`The recorded turn ended as ${exit.status}. Try again.`);

// Never keep machine paths in the recording.
const scrubbed = lastMessages
  .replaceAll(cwd, "/workspace")
  .replaceAll(home, "/opencode-home")
  .replaceAll(homedir(), "/home/user");
const output = resolve(import.meta.dirname, `../src/mocks/recorded/${version}-shell-turn.json`);
writeFileSync(output, `${JSON.stringify(JSON.parse(scrubbed), null, 2)}\n`);
console.log(`Recorded OpenCode ${version} messages in ${output}`);
process.exit(0);
