import { describe, expect, test } from "bun:test";
import { shouldEnsureApiForCommand as shouldEnsureApi } from "./cli-api-startup";

const groups = new Set(["agents", "auth", "auth tokens", "extensions", "projects"]);
const shouldEnsureApiForCommand = (argv: { _: unknown[] }) => shouldEnsureApi(argv, groups);

describe("shouldEnsureApiForCommand", () => {
  test("skips local extension install and check commands", () => {
    expect(shouldEnsureApiForCommand({ _: ["extensions", "add"] })).toBe(false);
    expect(shouldEnsureApiForCommand({ _: ["extensions", "check"] })).toBe(false);
  });

  test("keeps isolated smoke checks away from the caller runtime", () => {
    expect(shouldEnsureApiForCommand({ _: ["extensions", "test"] })).toBe(false);
  });

  test("installs the smoke browser without starting an API", () => {
    expect(shouldEnsureApiForCommand({ _: ["extensions", "install-browser"] })).toBe(false);
  });

  test("skips local logs command", () => {
    expect(shouldEnsureApiForCommand({ _: ["logs"] })).toBe(false);
  });

  test("reads local performance diagnostics without starting or calling a runtime", () => {
    expect(shouldEnsureApiForCommand({ _: ["performance"] })).toBe(false);
  });

  test("prints command group help without starting an API", () => {
    expect(shouldEnsureApiForCommand({ _: ["agents"] })).toBe(false);
    expect(shouldEnsureApiForCommand({ _: ["auth", "tokens"] })).toBe(false);
    expect(shouldEnsureApiForCommand({ _: ["extensions"] })).toBe(false);
  });

  test("keeps API startup for regular API-backed commands", () => {
    expect(shouldEnsureApiForCommand({ _: ["projects", "list"] })).toBe(true);
    expect(shouldEnsureApiForCommand({ _: ["extensions", "update"] })).toBe(true);
    expect(shouldEnsureApiForCommand({ _: ["auth", "tokens", "list"] })).toBe(true);
    expect(shouldEnsureApiForCommand({ _: ["inbox"] })).toBe(true);
  });
});

test("observes process metrics without depending on the runtime under observation", () => {
  expect(shouldEnsureApiForCommand({ _: ["performance-observer"] })).toBe(false);
});
