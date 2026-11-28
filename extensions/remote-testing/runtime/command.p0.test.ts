import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "./command";

const base = {
  cwd: "/",
  timeoutSeconds: 30,
  env: {},
  signal: new AbortController().signal,
  onOutput: () => {},
};

test("writes the full log and returns its tail", async () => {
  const directory = await mkdtemp(join(tmpdir(), "remote-testing-command-"));
  try {
    const logPath = join(directory, "run.log");
    const outcome = await runCommand({ ...base, command: "echo first; echo second; exit 3", logPath });
    expect(outcome).toMatchObject({ exitCode: 3, timedOut: false, aborted: false });
    expect(outcome.tail).toContain("second");
    expect(await readFile(logPath, "utf8")).toContain("first");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("does not start a command when the signal is already aborted", async () => {
  const controller = new AbortController();
  controller.abort();
  const outcome = await runCommand({
    ...base,
    command: "echo ran",
    logPath: join(tmpdir(), "remote-testing-command-unused.log"),
    signal: controller.signal,
  });
  expect(outcome).toEqual({ exitCode: null, timedOut: false, aborted: true, tail: "" });
});

test("rejects with the log stream error instead of crashing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "remote-testing-command-"));
  try {
    // A directory path makes the log stream fail while the command runs.
    await expect(runCommand({ ...base, command: "echo hi", logPath: directory })).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
