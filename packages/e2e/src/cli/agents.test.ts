import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi();
}, 20_000);

afterAll(() => {
  api?.stop();
});

const run = (args: string) => runPstdio(args, process.cwd(), { PSTDIO_API_URL: api.url });

const runSafe = (args: string) => runPstdioSafe(args, process.cwd(), { PSTDIO_API_URL: api.url });

describe("pstdio agents list", () => {
  test("lists known agents with none configured", () => {
    const output = run("agents list");

    expect(output).toContain("Claude Code");
    expect(output).toContain("OpenCode");
  });
});

describe("pstdio agents setup", () => {
  test("configures a known agent as default", () => {
    const output = run("agents setup opencode");

    expect(output).toContain('Agent "opencode" configured');
    expect(output).toContain("(default)");
  });

  test("configures a second agent without default", () => {
    const output = run("agents setup claude-code");

    expect(output).toContain('Agent "claude-code" configured');
    expect(output).not.toContain("(default)");
  });

  test("rejects unknown agent", () => {
    const result = runSafe("agents setup unknown-agent");

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Unknown agent: unknown-agent");
  });
});

describe("pstdio agents remove", () => {
  test("removes a configured agent", () => {
    const output = run("agents remove opencode");

    expect(output).toContain('Agent "opencode" removed.');
  });
});
