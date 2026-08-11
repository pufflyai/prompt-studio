import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../workbench-core";
import type { PersistedWorkbenchHistory, WorkbenchHistoryPersistence } from "./history-controller";

const RESOURCE_KIND = "history.test.stale-mode-resource";
const LOCATION_ID = "history.test.stale-mode-location";

const resource = (id: string) => ({
  kind: RESOURCE_KIND,
  uri: `${RESOURCE_KIND}:${id}`,
  id,
  label: id,
});

const entry = (id: string, modeId: string) => {
  const entryResource = resource(id);
  return {
    entryId: id,
    recordedAt: 1,
    kind: "resource" as const,
    modeId,
    location: {
      key: entryResource.uri,
      modeId,
      resource: entryResource,
      contributionId: LOCATION_ID,
    },
    resource: entryResource,
    contributionId: LOCATION_ID,
    selectedSubPanels: {},
  };
};

const createPersistence = (state: PersistedWorkbenchHistory): WorkbenchHistoryPersistence => ({
  getHistory: () => state,
  setHistory: () => undefined,
});

const registerFixtures = (workbench: ReturnType<typeof createWorkbenchCore>) => {
  workbench.resources.registerKind({ kind: RESOURCE_KIND, label: "Stale mode resource" });
  workbench.layout.registerLocation({
    id: LOCATION_ID,
    title: "Stale mode resource",
    region: "main",
    rendererId: "noop",
    resourceKinds: [RESOURCE_KIND],
  });
  workbench.resources.registerPresenter({
    id: "history.test.stale-mode-presenter",
    canOpen: (candidate) => candidate.kind === RESOURCE_KIND,
    open: (candidate) =>
      workbench.layout.openPanel(LOCATION_ID, {
        resource: candidate,
        strategy: { kind: "replace-active" },
      }),
  });
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.modes.setActiveMode("project");
};

describe("history stale mode recovery", () => {
  test("drops resource and recently closed entries whose mode is no longer registered", async () => {
    const validEntry = entry("valid", "project");
    const staleEntry = entry("stale", "removed-extension.mode");
    const workbench = createWorkbenchCore({
      historyPersistence: createPersistence({
        version: 1,
        entries: [validEntry, staleEntry],
        cursor: 1,
        recentlyClosed: [staleEntry],
      }),
    });
    registerFixtures(workbench);
    workbench.history.setPersistenceScope("project-one");

    expect(() => workbench.history.restore()).not.toThrow();
    await Promise.resolve();

    expect(workbench.history.store.getState()).toMatchObject({
      entries: [{ entryId: "valid" }],
      cursor: 0,
      recentlyClosed: [],
    });
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.layout.getLayout().activeResourceUri).toBe(resource("valid").uri);
  });

  test("removes a mode whose activation fails and restores the previous entry", async () => {
    const validEntry = entry("valid", "project");
    const brokenModeEntry = {
      ...entry("broken", "broken-extension.mode"),
      kind: "mode" as const,
      resource: undefined,
      contributionId: undefined,
      location: { key: "mode:broken-extension.mode", modeId: "broken-extension.mode" },
    };
    const workbench = createWorkbenchCore({
      historyPersistence: createPersistence({
        version: 1,
        entries: [validEntry, brokenModeEntry],
        cursor: 1,
        recentlyClosed: [],
      }),
    });
    registerFixtures(workbench);
    workbench.modes.registerMode({
      id: "broken-extension.mode",
      activate: () => {
        throw new Error("Mode activation failed");
      },
    });
    workbench.history.setPersistenceScope("project-one");

    expect(() => workbench.history.restore()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(workbench.history.store.getState()).toMatchObject({
      entries: [{ entryId: "valid" }],
      cursor: 0,
      hydrating: false,
    });
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.layout.getLayout().activeResourceUri).toBe(resource("valid").uri);
  });
});
