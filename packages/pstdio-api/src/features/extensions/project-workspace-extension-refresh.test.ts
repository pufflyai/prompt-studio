import { expect, test } from "bun:test";
import { EventBus } from "../sync/event-bus";
import { subscribeProjectWorkspaceExtensionRefresh } from "./project-workspace-extension-refresh";

const setup = () => {
  const eventBus = new EventBus();
  const invalidations: unknown[] = [];
  let refreshes = 0;
  const unsubscribe = subscribeProjectWorkspaceExtensionRefresh({
    eventBus,
    invalidate: (input) => invalidations.push(input),
    refreshWatchers: () => {
      refreshes++;
    },
  });
  return { eventBus, invalidations, unsubscribe, refreshes: () => refreshes };
};

test("refreshes project extensions when the default folder becomes ready", () => {
  const state = setup();
  const home = {
    id: "home",
    project_id: "project-1",
    is_default: true,
    execution_kind: "local",
    root_path: "/folder",
    initializing: false,
    setup_error: null,
    provider_state: "ready",
  };
  state.eventBus.emit("workspaces", "set", home);
  expect(state.refreshes()).toBe(1);
  expect(state.invalidations).toEqual([{ projectId: "project-1", reason: "project_workspace_changed" }]);
  state.unsubscribe();
  state.eventBus.emit("workspaces", "set", home);
  expect(state.refreshes()).toBe(1);
});

test("waits for folder initialization before starting extension watchers", () => {
  const state = setup();
  const home = {
    id: "home",
    project_id: "project-1",
    is_default: true,
    execution_kind: "local",
    root_path: "/folder",
    initializing: false,
    setup_error: null,
    provider_state: "ready",
  };
  for (const patch of [
    { initializing: true },
    { setup_error: "Failed" },
    { is_default: false },
    { execution_kind: "remote", root_path: null },
    { provider_state: "provisioning" },
  ])
    state.eventBus.emit("workspaces", "set", { ...home, ...patch });
  state.eventBus.emit("sessions", "set", { id: "session" });
  expect(state.refreshes()).toBe(0);
});
