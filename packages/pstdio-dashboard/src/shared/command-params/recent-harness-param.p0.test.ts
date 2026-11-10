import { describe, expect, test } from "bun:test";
import {
  createMemoryRecentHarnessStorage,
  readRecentHarnessSelection,
  readRecentHarnessSetup,
  resolveInitialHarnessSelection,
  saveRecentHarnessSelection,
} from "./recent-harness-param";

describe("recent harness params", () => {
  test("restores explicit harness parameters after reopening the project", () => {
    const storage = createMemoryRecentHarnessStorage();
    const selection = { harnessId: "codex", model: "gpt-5", params: { model_reasoning_effort: "high" } };

    saveRecentHarnessSelection("project-a", selection, storage);

    expect(readRecentHarnessSelection("project-a", storage)).toMatchObject(selection);
    expect(readRecentHarnessSetup("project-a", "codex", storage)).toEqual({
      model: "gpt-5",
      params: { model_reasoning_effort: "high" },
    });
    expect(readRecentHarnessSelection("project-b", storage)).toBeUndefined();
  });

  test("restores the last selected model for each harness", () => {
    const storage = createMemoryRecentHarnessStorage();
    saveRecentHarnessSelection("project-a", { harnessId: "opencode", model: "openai/gpt-5.5" }, storage);
    saveRecentHarnessSelection("project-a", { harnessId: "codex", model: "gpt-5" }, storage);

    const recent = readRecentHarnessSelection("project-a", storage);
    expect(recent).toMatchObject({ harnessId: "codex", model: "gpt-5" });
    expect(readRecentHarnessSetup("project-a", "opencode", storage)).toEqual({ model: "openai/gpt-5.5" });

    expect(
      resolveInitialHarnessSelection({
        current: { harnessId: "opencode", model: "" },
        recent,
        defaultAgent: "codex",
      }),
    ).toEqual({ harnessId: "opencode", model: "openai/gpt-5.5" });
  });

  test("restores a saved setup for an explicitly selected harness", () => {
    const storage = createMemoryRecentHarnessStorage();
    saveRecentHarnessSelection(
      "project-a",
      { harnessId: "opencode", model: "openai/gpt-5.5", params: { variant: "high" } },
      storage,
    );
    saveRecentHarnessSelection("project-a", { harnessId: "codex", model: "gpt-5" }, storage);

    expect(
      resolveInitialHarnessSelection({
        current: { harnessId: "opencode", model: "" },
        recent: readRecentHarnessSelection("project-a", storage),
        defaultAgent: "codex",
      }),
    ).toEqual({ harnessId: "opencode", model: "openai/gpt-5.5", params: { variant: "high" } });
  });

  test("switching a harness without a model keeps that harness's saved setup", () => {
    const storage = createMemoryRecentHarnessStorage();
    saveRecentHarnessSelection(
      "project-a",
      { harnessId: "opencode", model: "openai/gpt-5.5", params: { variant: "high" } },
      storage,
    );
    saveRecentHarnessSelection("project-a", { harnessId: "codex", model: "gpt-5" }, storage);
    saveRecentHarnessSelection("project-a", { harnessId: "opencode" }, storage);

    expect(readRecentHarnessSelection("project-a", storage)).toMatchObject({
      harnessId: "opencode",
      model: "openai/gpt-5.5",
      params: { variant: "high" },
    });
  });

  test("keeps a legacy last-used setup when saving another harness", () => {
    const storage = createMemoryRecentHarnessStorage();
    storage.setItem(
      "pstdio-dashboard:command-params:recent-harness:project-a",
      JSON.stringify({ harnessId: "opencode", model: "openai/gpt-5.5" }),
    );

    saveRecentHarnessSelection("project-a", { harnessId: "codex", model: "gpt-5" }, storage);

    expect(readRecentHarnessSetup("project-a", "opencode", storage)).toEqual({ model: "openai/gpt-5.5" });
  });

  test("keeps remembered parameters when another picker updates the same harness", () => {
    const storage = createMemoryRecentHarnessStorage();
    saveRecentHarnessSelection("project-a", { harnessId: "codex", params: { effort: "high" } }, storage);
    saveRecentHarnessSelection("project-a", { harnessId: "codex", model: "gpt-5" }, storage);
    expect(readRecentHarnessSelection("project-a", storage)?.params).toEqual({ effort: "high" });
    saveRecentHarnessSelection("project-a", { harnessId: "claude" }, storage);
    expect(readRecentHarnessSelection("project-a", storage)?.params).toBeUndefined();
  });

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
