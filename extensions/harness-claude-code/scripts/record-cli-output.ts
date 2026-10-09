// Records real Claude Code stream output for the supported-version replay tests.
// Usage: bun scripts/record-cli-output.ts <claude executable>
// Requires a signed-in Claude Code. Rerun at the minimum and latest versions when the minimum changes.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { buildStartSessionArgs } from "../src/spawn";

const executable = process.argv[2] ?? "claude";
const version = spawnSync(executable, ["--version"], { encoding: "utf8" }).stdout.match(/\d+\.\d+\.\d+/)?.[0];
if (!version) throw new Error(`${executable} did not report a version.`);
const outputDir = resolve(import.meta.dirname, "../src/mocks/recorded");

const scenarios = {
  "background-task":
    "Start the shell command `sleep 8 && echo finished` with the Bash tool using run_in_background: true. Then reply only with the word started. Do not wait for it.",
  question:
    "Use the AskUserQuestion tool once to ask me whether I prefer Red or Blue (two options). After I answer, reply with only the color I chose.",
};

// Keep only what the harness reads from the init event, and never machine paths or account details.
// Rate limits describe the account, and command lists name the recorder's own commands and skills.
const scrub = (event: Record<string, unknown>, cwd: string) => {
  if (event.type === "rate_limit_event" || event.subtype === "commands_changed") return undefined;
  if (event.type === "system" && event.subtype === "init")
    return { type: "system", subtype: "init", session_id: event.session_id, model: event.model };
  return JSON.parse(JSON.stringify(event).replaceAll(cwd, "/workspace").replaceAll(homedir(), "/home/user"));
};

const record = (name: keyof typeof scenarios) =>
  new Promise<void>((done, fail) => {
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), "claude-record-")));
    const args = buildStartSessionArgs({ model: "haiku", params: { thinking: "low" } });
    const child = spawn(executable, args, { cwd, env: { ...process.env, CLAUDECODE: "" } });
    const events: unknown[] = [];
    let runningTasks = 0;
    const timer = setTimeout(() => {
      child.kill();
      fail(new Error(`${name} timed out.`));
    }, 180_000);
    createInterface({ input: child.stdout }).on("line", (line) => {
      const event = JSON.parse(line) as Record<string, any>;
      const kept = scrub(event, cwd);
      if (kept) events.push(kept);
      if (event.type === "system" && event.subtype === "background_tasks_changed") runningTasks = event.tasks.length;
      if (event.type === "control_request" && event.request?.tool_name === "AskUserQuestion") {
        const input = event.request.input;
        const answers = Object.fromEntries(input.questions.map((q: any) => [q.question, q.options[0].label]));
        const response = { behavior: "allow", updatedInput: { ...input, answers } };
        const reply = {
          type: "control_response",
          response: { subtype: "success", request_id: event.request_id, response },
        };
        child.stdin.write(`${JSON.stringify(reply)}\n`);
      }
      if (event.type === "result" && runningTasks === 0) child.stdin.end();
    });
    child.on("exit", () => {
      clearTimeout(timer);
      writeFileSync(
        join(outputDir, `${version}-${name}.jsonl`),
        `${events.map((e) => JSON.stringify(e)).join("\n")}\n`,
      );
      done();
    });
    child.stdin.write(`${JSON.stringify({ type: "user", message: { role: "user", content: scenarios[name] } })}\n`);
  });

for (const name of Object.keys(scenarios) as (keyof typeof scenarios)[]) await record(name);
console.log(`Recorded Claude Code ${version} output in ${outputDir}`);
