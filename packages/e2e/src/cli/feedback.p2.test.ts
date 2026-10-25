import { describe, expect, test } from "bun:test";
import { createTempDir, runPstdioSafe } from "./helpers";
import { TEST_TIMEOUT } from "./timeouts";

const commandGroups = [
  "agents",
  "auth",
  "auth tokens",
  "automation",
  "connections",
  "extensions",
  "notifications",
  "projects",
  "resources",
  "sessions",
  "views",
  "workspaces",
];

// No API runs in these tests and auto-start stays disabled, so any command that needs one fails.
const runOffline = (args: string) => runPstdioSafe(args, createTempDir(), { PSTDIO_DISABLE_API_AUTO_START: "1" });

describe("cli help and feedback", () => {
  for (const group of commandGroups) {
    test(
      `shows ${group} help without an API when the subcommand is missing`,
      () => {
        const result = runOffline(group);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stdout).toContain(`pstdio ${group} [command]`);
        expect(result.stdout).toContain("Commands:");
      },
      TEST_TIMEOUT,
    );
  }

  test(
    "prints an error and group help for an unknown subcommand",
    () => {
      const result = runOffline("agents bogus");

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unknown argument: bogus");
      expect(result.stderr).toContain("pstdio agents list");
    },
    TEST_TIMEOUT,
  );

  test(
    "prints an error and nested group help for an unknown nested subcommand",
    () => {
      const result = runOffline("auth tokens bogus");

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unknown argument: bogus");
      expect(result.stderr).toContain("pstdio auth tokens issue");
    },
    TEST_TIMEOUT,
  );

  test(
    "prints error and root help for unknown command",
    () => {
      const result = runOffline("foo");

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Unknown argument: foo");
    },
    TEST_TIMEOUT,
  );
});
