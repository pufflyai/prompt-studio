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

  test("falls back to the first installed harness when there is no recent or default", () => {
    expect(
      resolveInitialHarnessSelection({
        current: { harnessId: "", model: "" },
        recent: undefined,
        defaultAgent: undefined,
        agents: [
          { id: "missing", availability: { type: "NOT_FOUND" } },
          { id: "claude-code", availability: { type: "INSTALLED" } },
          { id: "codex", availability: { type: "INSTALLED" } },
        ],
      }),
    ).toEqual({ harnessId: "claude-code", model: "" });
  });

  test("falls back to the first harness when none report availability", () => {
    expect(
      resolveInitialHarnessSelection({
        current: { harnessId: "", model: "" },
        recent: undefined,
        defaultAgent: null,
        agents: [{ id: "codex" }, { id: "claude-code" }],
      }),
    ).toEqual({ harnessId: "codex", model: "" });
  });

  test("stays empty when there are no harnesses to choose from", () => {
    expect(
      resolveInitialHarnessSelection({
        current: { harnessId: "", model: "" },
        recent: undefined,
        defaultAgent: undefined,
        agents: [],
      }),
    ).toEqual({ harnessId: "", model: "" });
  });
});
