import { createWorkspaceService } from "../../services/workspace-service";
import { EventBus } from "../sync/event-bus";
import type { ProvisionCoordinatorDeps, WorkspaceProvisioningHooks } from "./provision-coordinator";

export const maintenanceFixture = (count = 65) => {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: `ws-${index}`,
    project_id: "project",
    initializing: false,
    setup_error: null as string | null,
    root_path: `/workspaces/${index}`,
    execution_kind: "local",
    provider_id: "custom.local",
    provider_state: "ready",
  }));
  const eventBus = new EventBus();
  let scans = 0;
  const raw = {
    get: async (id: string) => rows.find((row) => row.id === id) ?? null,
    getDefault: async () => rows[0],
    list: async () => {
      scans++;
      return rows.map((row) => ({ ...row }));
    },
    setInitializing: async (id: string, initializing: boolean) =>
      Object.assign(rows.find((row) => row.id === id)!, { initializing }),
    setSetupError: async (id: string, setup_error: string | null) =>
      Object.assign(rows.find((row) => row.id === id)!, { setup_error, initializing: false }),
  };
  const workspaceService = createWorkspaceService({
    workspacesDb: raw as never,
    sessionsDb: { get: async () => null },
    eventBus,
  });
  const deps = { workspaceService, eventBus } as unknown as ProvisionCoordinatorDeps;
  const calls: string[] = [];
  const hooks: WorkspaceProvisioningHooks = {
    ensureConfig: async () => {},
    fireReadyAsync: () => {
      throw new Error("Maintenance must not publish workspace.ready");
    },
    fireProvision: async (_deps, _projectId, _event, payload) => {
      calls.push((payload as { workspaceId: string }).workspaceId);
      return { delivered: 1 };
    },
  };
  return {
    deps,
    raw,
    rows,
    hooks,
    calls,
    eventBus,
    get scans() {
      return scans;
    },
  };
};
