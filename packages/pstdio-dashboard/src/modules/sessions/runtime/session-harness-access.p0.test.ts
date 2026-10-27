import { expect, test } from "bun:test";
import type { AgentInfo } from "pstdio-api-contracts";
import { sessionHarnessAccess } from "./session-harness-access";

const agent = (id: string, installed: boolean): AgentInfo => ({
  id,
  name: id,
  availability: { type: installed ? "INSTALLED" : "NOT_FOUND" },
  capabilities: [],
  supportsModels: true,
});

test("only reports no harness after availability is known and none is installed", () => {
  expect(sessionHarnessAccess([], "codex", false)).toBe("checking");
  expect(sessionHarnessAccess([], "codex", true)).toBe("missing");
  expect(sessionHarnessAccess([agent("codex", false)], "codex", true)).toBe("missing");
  expect(sessionHarnessAccess([agent("codex", false), agent("claude", true)], "codex", true, "not_required")).toBe(
    "ready",
  );
});

test("requires login only when the selected installed harness is confirmed signed out", () => {
  expect(sessionHarnessAccess([agent("codex", true)], "codex", true, "signed_out")).toBe("signed_out");
  expect(sessionHarnessAccess([agent("codex", true)], "codex", true, "not_required")).toBe("ready");
  expect(sessionHarnessAccess([agent("codex", true)], "codex", true, "not_required")).toBe("ready");
  expect(sessionHarnessAccess([agent("remote", true)], "remote", true, "not_required")).toBe("ready");
});
