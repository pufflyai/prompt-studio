import { describe, expect, test } from "bun:test";
import { commandRef } from "./refs";

describe("commandRef", () => {
  test("scopes provider-owned references from package identity", () => {
    const plannerCommand = commandRef.forExtension({ publisher: "pstdio", name: "pstdio-planner" });

    expect(plannerCommand("automation-policy")).toEqual({
      extensionId: "pstdio.pstdio-planner",
      kind: "command",
      id: "automation-policy",
    });
  });
});
