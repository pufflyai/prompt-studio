import { spawn } from "node:child_process";

const BUN_TEST_ARGS = ["test", "--parallel=1", "--silent"];
const SUCCESS_EXIT_GRACE_MS = 1000;
const ANSI_ESCAPE_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");

const stripAnsi = (value: string) => value.replace(ANSI_ESCAPE_PATTERN, "");

export const hasSuccessfulBunTestSummary = (output: string) => {
  const text = stripAnsi(output);

  return (
    /(?:^|\n)\s+\d+\s+pass\b/.test(text) &&
    /(?:^|\n)\s+0\s+fail\b/.test(text) &&
    /Ran\s+\d+\s+tests?\s+across\s+\d+\s+files?\./.test(text)
  );
};

const runTests = async () =>
  new Promise<number>((resolve) => {
    let settled = false;
    let output = "";
    let successTimer: Timer | undefined;

    const child = spawn(process.execPath, BUN_TEST_ARGS, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const settle = (code: number) => {
      if (settled) return;
      settled = true;
      if (successTimer) clearTimeout(successTimer);
      resolve(code);
    };

    const scheduleSuccessfulExit = () => {
      if (successTimer) return;

      successTimer = setTimeout(() => {
        child.kill("SIGTERM");
        settle(0);
      }, SUCCESS_EXIT_GRACE_MS);
    };

    const forwardOutput = (stream: NodeJS.WriteStream, chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      stream.write(text);

      if (hasSuccessfulBunTestSummary(output)) {
        scheduleSuccessfulExit();
      }
    };

    child.stdout.on("data", (chunk) => forwardOutput(process.stdout, chunk));
    child.stderr.on("data", (chunk) => forwardOutput(process.stderr, chunk));
    child.on("error", (error) => {
      console.error(error);
      settle(1);
    });
    child.on("exit", (code) => settle(code ?? 1));
  });

if (Bun.main === import.meta.path) {
  const code = await runTests();
  process.exit(code);
}
