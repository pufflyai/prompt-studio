import { describe, expect, test } from "bun:test";
import { shouldEnsureApiForCommand } from "./cli-api-startup";

describe("shouldEnsureApiForCommand", () => {
  test("skips local extension install and check commands", () => {
    expect(shouldEnsureApiForCommand({ _: ["extensions", "add"] })).toBe(false);
    expect(shouldEnsureApiForCommand({ _: ["extensions", "check"] })).toBe(false);
  });

  test("skips local logs command", () => {
    expect(shouldEnsureApiForCommand({ _: ["logs"] })).toBe(false);
  });

  test("keeps API startup for regular API-backed commands", () => {
    expect(shouldEnsureApiForCommand({ _: ["projects", "list"] })).toBe(true);
  });
});
