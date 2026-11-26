import { readWorkbenchContext, subscribeWorkbenchContext, type WorkbenchCore } from "@pstdio/workbench";
import type { WorkbenchOrigin } from "pstdio-api-contracts";
import { buildApiUrl } from "@/lib/api";
import type { RuntimeCollections } from "@/lib/sync/collections";

const connections = new WeakMap<WorkbenchCore, { id: string; projectId: string; dispose(): void }>();

export const captureWorkbenchContext = (
  runtime: RuntimeCollections,
  projectId: string,
  core: WorkbenchCore,
  composer: string,
): WorkbenchOrigin | undefined => {
  const row = runtime.getCollection("projects")?.get(projectId);
  const project = { id: projectId, label: typeof row?.name === "string" ? row.name.slice(0, 200) : undefined };
  const snapshot = readWorkbenchContext(core, project, composer);
  if (!snapshot) return;
  const previous = connections.get(core);
  if (previous?.projectId === projectId) return { id: previous.id, snapshot };
  previous?.dispose();

  const id = crypto.randomUUID();
  const url = buildApiUrl(`/v1/projects/${encodeURIComponent(projectId)}/workbench-context/${id}`);
  const send = (method: "PUT" | "DELETE", body?: string) =>
    fetch(method === "DELETE" ? `${url}?at=${encodeURIComponent(new Date().toISOString())}` : url, {
      method,
      body,
      keepalive: method === "DELETE",
      headers: {
        ...(runtime.connection.token ? { Authorization: `Bearer ${runtime.connection.token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
    }).catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const update = () => {
    if (disposed) return;
    const live = readWorkbenchContext(core, project);
    if (live) void send("PUT", JSON.stringify(live));
    else dispose();
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(update, 150);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timer);
    clearInterval(heartbeat);
    unsubscribe();
    disconnect();
    document.removeEventListener("focusin", schedule);
    window.removeEventListener("pagehide", dispose);
    connections.delete(core);
    void send("DELETE");
  };
  const unsubscribe = subscribeWorkbenchContext(core, schedule, dispose);
  const disconnect = runtime.onDispose(dispose);
  const heartbeat = setInterval(update, 12000);
  document.addEventListener("focusin", schedule);
  window.addEventListener("pagehide", dispose);
  connections.set(core, { id, projectId, dispose });
  update();
  return { id, snapshot };
};
