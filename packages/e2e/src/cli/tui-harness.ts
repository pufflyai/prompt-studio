import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PSTDIO_ENTRYPOINT = join(import.meta.dirname, "../../../pstdio/src/index.ts");
const ROOT_NODE_MODULES = join(import.meta.dirname, "../../../../node_modules");

export const TUI_KEYS = {
  ENTER: "\r",
  ESC: "\u001b",
  TAB: "\t",
  SHIFT_TAB: "\u001b[Z",
  DOWN: "\u001b[B",
  UP: "\u001b[A",
} as const;

type TuiStep =
  | { type: "expect"; text: string }
  | { type: "send"; text: string }
  | { type: "type"; text: string; delayMs?: number }
  | { type: "sleep"; ms: number }
  | { type: "exec"; command: string };

const ANSI_ESCAPE_PATTERN = "\\u001B(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])";
const ANSI_ESCAPE_REGEX = new RegExp(ANSI_ESCAPE_PATTERN, "g");
const stripAnsi = (value: string) => value.replace(ANSI_ESCAPE_REGEX, "").replace(/\r/g, "");

const escapeTcl = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");

const toTclByteString = (value: string) => {
  let out = "";

  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;

    if (char === "\\") {
      out += "\\\\";
      continue;
    }

    if (char === '"') {
      out += '\\"';
      continue;
    }

    if (char === "[" || char === "]" || char === "$") {
      out += `\\${char}`;
      continue;
    }

    if (code < 32 || code === 127) {
      out += `\\x${code.toString(16).padStart(2, "0")}`;
      continue;
    }

    out += char;
  }

  return out;
};

const buildScript = (steps: TuiStep[], logPath: string, timeoutMs: number) => {
  const launchCommand = `stty rows 40 columns 120; bun run "${escapeTcl(PSTDIO_ENTRYPOINT)}" tui`;
  const lines = [
    "log_user 1",
    "match_max 100000",
    `set timeout ${Math.ceil(timeoutMs / 1000)}`,
    `log_file -noappend "${escapeTcl(logPath)}"`,
    `spawn -noecho sh -lc "${escapeTcl(launchCommand)}"`,
  ];

  for (const step of steps) {
    if (step.type === "expect") {
      lines.push(`expect -exact "${escapeTcl(step.text)}"`);
      continue;
    }

    if (step.type === "send") {
      lines.push(`send -- "${toTclByteString(step.text)}"`);
      continue;
    }

    if (step.type === "type") {
      const delayMs = step.delayMs ?? 25;
      lines.push(`set send_slow {1 ${delayMs / 1000}}`);
      lines.push(`send -s -- "${toTclByteString(step.text)}"`);
      continue;
    }

    if (step.type === "sleep") {
      lines.push(`after ${step.ms}`);
      continue;
    }

    lines.push(`exec sh -lc "${escapeTcl(step.command)}"`);
  }

  lines.push("after 300");
  lines.push("catch {close}");
  lines.push("catch {wait}");
  lines.push("log_file");

  return lines.join("\n");
};

const buildFailure = (message: string, transcript: string) => {
  const plain = stripAnsi(transcript);
  const tail = plain.split("\n").slice(-40).join("\n");
  return new Error(`${message}\n\nTUI transcript tail:\n${tail}`);
};

export const runTuiScenario = ({
  cwd,
  apiUrl,
  steps,
  timeoutMs = 30_000,
}: {
  cwd: string;
  apiUrl: string;
  steps: TuiStep[];
  timeoutMs?: number;
}) => {
  const runDir = mkdtempSync(join(tmpdir(), "pstdio-tui-expect-"));
  const transcriptPath = join(runDir, "transcript.log");
  const script = buildScript(steps, transcriptPath, timeoutMs);

  try {
    execFileSync("expect", ["-c", script], {
      cwd,
      env: {
        ...process.env,
        PSTDIO_API_URL: apiUrl,
        NODE_PATH: process.env.NODE_PATH ? `${ROOT_NODE_MODULES}:${process.env.NODE_PATH}` : ROOT_NODE_MODULES,
      },
      encoding: "utf8",
      timeout: timeoutMs,
      stdio: "pipe",
    });
  } catch (error) {
    const transcript = readFileSync(transcriptPath, "utf8");
    rmSync(runDir, { recursive: true, force: true });

    const reason = error instanceof Error ? error.message : String(error);
    throw buildFailure(`TUI scenario failed: ${reason}`, transcript);
  }

  const transcript = readFileSync(transcriptPath, "utf8");
  rmSync(runDir, { recursive: true, force: true });

  return stripAnsi(transcript);
};

export type { TuiStep };
