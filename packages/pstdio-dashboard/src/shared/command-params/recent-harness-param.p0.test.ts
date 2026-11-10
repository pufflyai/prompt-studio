import { describe, expect, test } from "bun:test";
import { resolveSynchronizedModel } from "../agents/agent-model-selection";
import {
  createMemoryRecentHarnessStorage,
  readRecentHarnessSelection,
  readRecentHarnessSetup,
  resolveInitialHarnessSelection,
  saveRecentHarnessSelection,
} from "./recent-harness-param";

describe("recent harness params", () => {
  test("does not restore a model after the loaded catalog clears the current selection", () => {
    const recent = { harnessId: "codex", model: "retired" };
    let current = { harnessId: "codex", model: "retired" };
    const changes: string[] = [];
    for (let render = 0; render < 3; render++) {
      const initial = resolveInitialHarnessSelection({ current, recent, defaultAgent: "codex" });
      if (initial.model !== current.model) changes.push(initial.model);
      const synchronized = resolveSynchronizedModel({
        currentAgent: initial.harnessId,
        currentModel: initial.model,
        modelsQuery: { isPending: false, data: [] },
        modelHistory: [],
      });
      if (synchronized !== undefined && synchronized !== initial.model) changes.push(synchronized);
      current = { harnessId: initial.harnessId, model: synchronized ?? initial.model };
    }
    expect(current).toEqual({ harnessId: "codex", model: "" });
    expect(changes).toEqual([""]);
  });

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
        current: { harnessId: "", model: "" },
        recent: { ...recent!, harnessId: "opencode" },
        defaultAgent: "codex",
      }),
    ).toEqual({ harnessId: "opencode", model: "openai/gpt-5.5" });
  });

  test("restores a saved setup when initializing the last-used harness", () => {
    const storage = createMemoryRecentHarnessStorage();
    saveRecentHarnessSelection(
      "project-a",
      { harnessId: "opencode", model: "openai/gpt-5.5", params: { variant: "high" } },
      storage,
    );
    saveRecentHarnessSelection("project-a", { harnessId: "codex", model: "gpt-5" }, storage);

    expect(
      resolveInitialHarnessSelection({
        current: { harnessId: "", model: "" },
        recent: { ...readRecentHarnessSelection("project-a", storage)!, harnessId: "opencode" },
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
