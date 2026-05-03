import { describe, expect, test } from "bun:test";
import { checkExtensionAvailability, findRecoveryHint, formatRecoveryMessage, getRecoveryHints } from "./recovery";

describe("recovery hint registry", () => {
  test("finds a hint for a familiar planner path", () => {
    const hint = findRecoveryHint(["planner", "tickets", "pull"]);
    expect(hint?.providerId).toBe("pstdio.planner");
    expect(hint?.install).toBe("planner");
  });

  test("matches harness claude-code detect", () => {
    const hint = findRecoveryHint(["harness", "claude-code", "detect"]);
    expect(hint?.providerId).toBe("pstdio.harness.claude-code");
  });

  test("ignores unrelated paths", () => {
    expect(findRecoveryHint(["unknown", "thing"])).toBeUndefined();
  });

  test("ignores partial token matches", () => {
    expect(findRecoveryHint(["planner"])).toBeUndefined();
  });

  test("exposes the registered hint table", () => {
    expect(getRecoveryHints().length).toBeGreaterThan(0);
  });
});

describe("formatRecoveryMessage", () => {
  test("missing extension prints provider id and install hint", () => {
    const text = formatRecoveryMessage({
      hint: { path: ["planner", "tickets", "pull"], providerId: "pstdio.planner", install: "planner" },
      invokedPath: ["planner", "tickets", "pull"],
      status: "missing",
    });
    expect(text).toContain("Command not found: pstdio planner tickets pull");
    expect(text).toContain("pstdio.planner");
    expect(text).toContain("pstdio extensions add planner");
    expect(text).toContain("pstdio extensions check");
  });

  test("installed-disabled prints enable hint", () => {
    const text = formatRecoveryMessage({
      hint: { path: ["planner", "tickets", "pull"], providerId: "pstdio.planner" },
      invokedPath: ["planner", "tickets", "pull"],
      status: "installed-disabled",
    });
    expect(text).toContain("appears to be installed but disabled");
    expect(text).toContain("pstdio extensions enable pstdio.planner");
  });
});

describe("checkExtensionAvailability", () => {
  test("returns installed=true when the runtime has the extension", () => {
    const result = checkExtensionAvailability(
      {
        extensions: [
          {
            id: "pstdio.planner",
            namespace: "planner",
            displayName: "Planner",
            sourcePath: "/x",
            sourceKind: "local",
            // biome-ignore lint/suspicious/noExplicitAny: test fixture
            definition: {} as any,
          },
        ],
      },
      "pstdio.planner",
    );
    expect(result.installed).toBe(true);
    expect(result.enabled).toBe(true);
  });

  test("returns installed=false when the extension is missing", () => {
    const result = checkExtensionAvailability({ extensions: [] }, "pstdio.planner");
    expect(result.installed).toBe(false);
  });
});
