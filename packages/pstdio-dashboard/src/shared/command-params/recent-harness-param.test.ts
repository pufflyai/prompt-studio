import { describe, expect, test } from "bun:test";
import {
  createMemoryRecentHarnessStorage,
  readRecentHarnessSelection,
  resolveInitialHarnessSelection,
  saveRecentHarnessSelection,
} from "./recent-harness-param";

describe("recent harness params", () => {
  test("prefers a project recent harness before the project default", () => {
    const storage = createMemoryRecentHarnessStorage();

    saveRecentHarnessSelection("project-a", { harnessId: "codex", model: "gpt-5" }, storage);

    expect(
      resolveInitialHarnessSelection({
        current: { harnessId: "", model: "" },
        recent: readRecentHarnessSelection("project-a", storage),
        defaultAgent: "opencode",
      }),
    ).toEqual({ harnessId: "codex", model: "gpt-5" });
  });

  test("keeps an explicit current harness over a recent harness", () => {
    expect(
      resolveInitialHarnessSelection({
        current: { harnessId: "opencode", model: "" },
        recent: { harnessId: "codex", model: "gpt-5" },
        defaultAgent: "claude-code",
      }),
    ).toEqual({ harnessId: "opencode", model: "" });
  });
});
