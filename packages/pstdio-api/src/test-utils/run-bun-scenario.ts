import { expect } from "bun:test";

export const runBunScenario = async (path: string, args: string[] = []) => {
  const child = Bun.spawn([process.execPath, "--conditions=source", path, ...args], { stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect(exitCode, stderr || stdout).toBe(0);
};
