import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fireTicketHook } from "./ticket-hooks";

let repoDir: string;

beforeEach(async () => {
  repoDir = await realpath(await mkdtemp(join(tmpdir(), "pstdio-ticket-hooks-test-")));
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

const writeHook = (hookName: string, script: string) => {
  const hooksDir = join(repoDir, ".pstdio", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const path = join(hooksDir, hookName);
  writeFileSync(path, `#!/bin/sh\n${script}`);
  chmodSync(path, 0o755);
};

const makeDeps = () => ({
  reposService: {
    listByProject: async () => [{ path: repoDir }],
  } as never,
});

describe("fireTicketHook", () => {
  test("pre-ticket-creation can modify payload", async () => {
    writeHook("pre-ticket-creation", 'jq \'. + {"priority": "medium"}\'');

    const result = await fireTicketHook(makeDeps(), "pre-ticket-creation", "proj-1", {
      title: "Test ticket",
    });

    expect(result.rejected).toBe(false);
    expect(result.modifiedPayload).toEqual({ title: "Test ticket", priority: "medium" });
  });

  test("pre-ticket-creation can reject", async () => {
    writeHook("pre-ticket-creation", 'echo "Missing description" >&2; exit 1');

    const result = await fireTicketHook(makeDeps(), "pre-ticket-creation", "proj-1", {
      title: "Incomplete",
    });

    expect(result.rejected).toBe(true);
    expect(result.stderr).toContain("Missing description");
  });

  test("post-ticket-creation does not reject on failure", async () => {
    writeHook("post-ticket-creation", "exit 1");

    const result = await fireTicketHook(makeDeps(), "post-ticket-creation", "proj-1", {
      id: "TK-1",
    });

    expect(result.rejected).toBe(false);
  });

  test("returns no modification when hook is skipped", async () => {
    const result = await fireTicketHook(makeDeps(), "pre-ticket-creation", "proj-1", {
      title: "Test",
    });

    expect(result.rejected).toBe(false);
    expect(result.modifiedPayload).toBeNull();
  });

  test("pre-ticket-status-change can reject", async () => {
    writeHook("pre-ticket-status-change", "exit 1");

    const result = await fireTicketHook(makeDeps(), "pre-ticket-status-change", "proj-1", {
      id: "TK-1",
      from: "backlog",
      to: "wip",
    });

    expect(result.rejected).toBe(true);
  });

  test("post-ticket-status-change fires without blocking", async () => {
    writeHook("post-ticket-status-change", "cat");

    const result = await fireTicketHook(makeDeps(), "post-ticket-status-change", "proj-1", {
      id: "TK-1",
      status: "wip",
    });

    expect(result.rejected).toBe(false);
  });

  test("pre-ticket-archive can reject", async () => {
    writeHook("pre-ticket-archive", "exit 1");

    const result = await fireTicketHook(makeDeps(), "pre-ticket-archive", "proj-1", {
      id: "TK-1",
    });

    expect(result.rejected).toBe(true);
  });

  test("pre-ticket-deletion can reject", async () => {
    writeHook("pre-ticket-deletion", "exit 1");

    const result = await fireTicketHook(makeDeps(), "pre-ticket-deletion", "proj-1", {
      id: "TK-1",
    });

    expect(result.rejected).toBe(true);
  });
});
