import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { createProjectSettingsStore } from "./create-project-settings-store";

beforeAll(() => {
  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    get length() {
      return storage.size;
    },
    key: (index: number) => [...storage.keys()][index] ?? null,
  };

  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
});

beforeEach(() => {
  globalThis.localStorage.clear();
});

describe("createProjectSettingsStore defaults", () => {
  it("has correct default state", () => {
    const store = createProjectSettingsStore();
    const state = store.getState();

    expect(state.lastSelectedAgent).toBe("opencode");
    expect(state.lastSelectedModels).toEqual([]);
    expect(state.lastSelectedRepo).toBe("");
    expect(state.lastSelectedBranches).toEqual([]);
    expect(state.sessionModalState).toBe("bubble");
    expect(state.selectedSessionId).toBeNull();
    expect(state.lastNonSessionsPath).toBeNull();
    expect(state.chatDraftsBySession).toEqual({});
  });

  it("accepts initial hydration", () => {
    const store = createProjectSettingsStore({
      initialState: {
        lastSelectedAgent: "claude-code",
        lastSelectedRepo: "repo-1",
      },
    });
    const state = store.getState();

    expect(state.lastSelectedAgent).toBe("claude-code");
    expect(state.lastSelectedRepo).toBe("repo-1");
  });
});

describe("createProjectSettingsStore setLastSelectedAgent", () => {
  it("updates the agent", () => {
    const store = createProjectSettingsStore();
    store.getState().setLastSelectedAgent("claude-code");
    expect(store.getState().lastSelectedAgent).toBe("claude-code");
  });
});

describe("createProjectSettingsStore setLastSelectedModel", () => {
  it("prepends model to the array", () => {
    const store = createProjectSettingsStore();
    store.getState().setLastSelectedModel("gpt-4");
    expect(store.getState().lastSelectedModels).toEqual(["gpt-4"]);
  });

  it("moves existing model to the front", () => {
    const store = createProjectSettingsStore({
      initialState: { lastSelectedModels: ["model-a", "model-b", "model-c"] },
    });
    store.getState().setLastSelectedModel("model-b");
    expect(store.getState().lastSelectedModels).toEqual(["model-b", "model-a", "model-c"]);
  });

  it("caps at 20 entries", () => {
    const initial = Array.from({ length: 20 }, (_, i) => `model-${i}`);
    const store = createProjectSettingsStore({ initialState: { lastSelectedModels: initial } });
    store.getState().setLastSelectedModel("new-model");

    const models = store.getState().lastSelectedModels;
    expect(models.length).toBe(20);
    expect(models[0]).toBe("new-model");
    expect(models).not.toContain("model-19");
  });

  it("ignores empty strings", () => {
    const store = createProjectSettingsStore();
    store.getState().setLastSelectedModel("");
    expect(store.getState().lastSelectedModels).toEqual([]);
  });
});

describe("createProjectSettingsStore setLastSelectedRepo", () => {
  it("updates the repo", () => {
    const store = createProjectSettingsStore();
    store.getState().setLastSelectedRepo("repo-42");
    expect(store.getState().lastSelectedRepo).toBe("repo-42");
  });
});

describe("createProjectSettingsStore setLastSelectedBranch", () => {
  it("prepends branch to the array", () => {
    const store = createProjectSettingsStore();
    store.getState().setLastSelectedBranch("main");
    expect(store.getState().lastSelectedBranches).toEqual(["main"]);
  });

  it("moves existing branch to the front", () => {
    const store = createProjectSettingsStore({
      initialState: { lastSelectedBranches: ["main", "dev", "staging"] },
    });
    store.getState().setLastSelectedBranch("staging");
    expect(store.getState().lastSelectedBranches).toEqual(["staging", "main", "dev"]);
  });

  it("caps at 20 entries", () => {
    const initial = Array.from({ length: 20 }, (_, i) => `branch-${i}`);
    const store = createProjectSettingsStore({ initialState: { lastSelectedBranches: initial } });
    store.getState().setLastSelectedBranch("new-branch");

    const branches = store.getState().lastSelectedBranches;
    expect(branches.length).toBe(20);
    expect(branches[0]).toBe("new-branch");
    expect(branches).not.toContain("branch-19");
  });

  it("ignores empty strings", () => {
    const store = createProjectSettingsStore();
    store.getState().setLastSelectedBranch("");
    expect(store.getState().lastSelectedBranches).toEqual([]);
  });
});

describe("createProjectSettingsStore setSessionModalState", () => {
  it("defaults to bubble", () => {
    const store = createProjectSettingsStore();
    expect(store.getState().sessionModalState).toBe("bubble");
  });

  it("updates the session modal state", () => {
    const store = createProjectSettingsStore();
    store.getState().setSessionModalState("attached");
    expect(store.getState().sessionModalState).toBe("attached");
  });

  it("cycles through all valid states", () => {
    const store = createProjectSettingsStore();
    store.getState().setSessionModalState("closed");
    expect(store.getState().sessionModalState).toBe("closed");
    store.getState().setSessionModalState("attached");
    expect(store.getState().sessionModalState).toBe("attached");
    store.getState().setSessionModalState("bubble");
    expect(store.getState().sessionModalState).toBe("bubble");
  });
});

describe("createProjectSettingsStore selectedSessionId", () => {
  it("defaults to null", () => {
    const store = createProjectSettingsStore();
    expect(store.getState().selectedSessionId).toBeNull();
  });

  it("sets a session id", () => {
    const store = createProjectSettingsStore();
    store.getState().setSelectedSessionId("session-123");
    expect(store.getState().selectedSessionId).toBe("session-123");
  });

  it("clears the session id with null", () => {
    const store = createProjectSettingsStore({ initialState: { selectedSessionId: "session-123" } });
    store.getState().setSelectedSessionId(null);
    expect(store.getState().selectedSessionId).toBeNull();
  });

  it("accepts initial hydration", () => {
    const store = createProjectSettingsStore({ initialState: { selectedSessionId: "session-456" } });
    expect(store.getState().selectedSessionId).toBe("session-456");
  });
});

describe("createProjectSettingsStore lastNonSessionsPath", () => {
  it("defaults to null", () => {
    const store = createProjectSettingsStore();
    expect(store.getState().lastNonSessionsPath).toBeNull();
  });

  it("updates the tracked path", () => {
    const store = createProjectSettingsStore();
    store.getState().setLastNonSessionsPath("/projects/p1/tickets");
    expect(store.getState().lastNonSessionsPath).toBe("/projects/p1/tickets");
  });

  it("persists the tracked path for a project store", () => {
    const store = createProjectSettingsStore({ projectId: "proj-path" });
    store.getState().setLastNonSessionsPath("/projects/proj-path/tickets");

    const rehydratedStore = createProjectSettingsStore({ projectId: "proj-path" });
    expect(rehydratedStore.getState().lastNonSessionsPath).toBe("/projects/proj-path/tickets");
  });
});

describe("createProjectSettingsStore chatDraftsBySession", () => {
  it("stores a draft for a session", () => {
    const store = createProjectSettingsStore();
    store.getState().setSessionDraft("session-1", "Follow-up question");

    expect(store.getState().chatDraftsBySession).toEqual({ "session-1": "Follow-up question" });
  });

  it("stores a draft for new sessions", () => {
    const store = createProjectSettingsStore();
    store.getState().setSessionDraft(null, "Draft for new session");

    expect(store.getState().chatDraftsBySession).toEqual({ __new__: "Draft for new session" });
  });

  it("removes draft entry when value is blank", () => {
    const store = createProjectSettingsStore({
      initialState: {
        chatDraftsBySession: {
          "session-1": "Existing draft",
        },
      },
    });

    store.getState().setSessionDraft("session-1", "   ");

    expect(store.getState().chatDraftsBySession).toEqual({});
  });

  it("clears draft for a specific session", () => {
    const store = createProjectSettingsStore({
      initialState: {
        chatDraftsBySession: {
          "session-1": "Keep",
          "session-2": "Remove",
        },
      },
    });

    store.getState().clearSessionDraft("session-2");

    expect(store.getState().chatDraftsBySession).toEqual({ "session-1": "Keep" });
  });

  it("clears draft for new sessions", () => {
    const store = createProjectSettingsStore({
      initialState: {
        chatDraftsBySession: {
          __new__: "Remove",
        },
      },
    });

    store.getState().clearSessionDraft(null);

    expect(store.getState().chatDraftsBySession).toEqual({});
  });
});

describe("createProjectSettingsStore reset", () => {
  it("resets to default state", () => {
    const store = createProjectSettingsStore({
      initialState: {
        lastSelectedAgent: "claude-code",
        lastSelectedModels: ["model-a"],
        lastSelectedRepo: "repo-1",
        lastSelectedBranches: ["main"],
        sessionModalState: "attached",
        chatDraftsBySession: { "session-1": "Draft" },
      },
    });

    store.getState().reset();
    const state = store.getState();

    expect(state.lastSelectedAgent).toBe("opencode");
    expect(state.lastSelectedModels).toEqual([]);
    expect(state.lastSelectedRepo).toBe("");
    expect(state.lastSelectedBranches).toEqual([]);
    expect(state.sessionModalState).toBe("bubble");
    expect(state.selectedSessionId).toBeNull();
    expect(state.lastNonSessionsPath).toBeNull();
    expect(state.chatDraftsBySession).toEqual({});
  });
});

describe("createProjectSettingsStore per-project persistence", () => {
  it("creates store without projectId", () => {
    const store = createProjectSettingsStore();
    store.getState().setLastSelectedRepo("global-repo");
    expect(store.getState().lastSelectedRepo).toBe("global-repo");
  });

  it("creates store with projectId", () => {
    const store = createProjectSettingsStore({ projectId: "proj-1" });
    store.getState().setLastSelectedRepo("proj-1-repo");
    expect(store.getState().lastSelectedRepo).toBe("proj-1-repo");
  });

  it("isolates state between projects", () => {
    const store1 = createProjectSettingsStore({ projectId: "proj-a" });
    store1.getState().setLastSelectedAgent("claude-code");

    const store2 = createProjectSettingsStore({ projectId: "proj-b" });
    store2.getState().setLastSelectedAgent("opencode");

    expect(store1.getState().lastSelectedAgent).toBe("claude-code");
    expect(store2.getState().lastSelectedAgent).toBe("opencode");
  });
});
