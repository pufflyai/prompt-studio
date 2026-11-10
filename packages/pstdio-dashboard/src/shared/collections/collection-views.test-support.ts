import { apiClientOptions } from "@/lib/api";
import {
  getWriter,
  markInitialCollectionsSyncComplete,
  releaseRuntimeCollections,
  retainRuntimeCollections,
} from "@/lib/sync/collections";
import { createSharedCollectionViews } from "./collection-views";

export let writer: NonNullable<ReturnType<typeof getWriter>>;
export const row = (id: string, sortOrder: number) => ({
  id,
  project_id: "project",
  extension_instance_id: null,
  board_id: "table",
  title: id,
  settings: {},
  filter: { conjunction: "and", rules: [] },
  sorts: [],
  sort_order: sortOrder,
  created_at: "2026-10-13",
});
export const ids = (source: ReturnType<typeof createSharedCollectionViews>) =>
  source.getSnapshot()!.views.map((view) => view.id);
const config = Object.getOwnPropertyDescriptor(globalThis, "__PSTDIO_CONFIG__");
const servers: ReturnType<typeof Bun.serve>[] = [];
const connections: ReturnType<typeof apiClientOptions>[] = [];

export const cleanup = async () => {
  writer?.truncateAndWrite([]);
  for (const connection of connections) await releaseRuntimeCollections(connection);
  connections.length = 0;
  for (const server of servers) server.stop(true);
  servers.length = 0;
  if (config) Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", config);
  else Reflect.deleteProperty(globalThis, "__PSTDIO_CONFIG__");
};

export const setup = (
  handle: (request: Request) => Promise<Response> | Response,
  readOrder: () => string[] | Response | Promise<Response> = () => ["a", "b", "c"],
) => {
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      if (new URL(request.url).pathname === "/v1/account")
        return Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true });
      if (request.method === "PUT") return handle(request);
      const current = await readOrder();
      return Array.isArray(current) ? Response.json({ views: current.map((id) => ({ id })) }) : current;
    },
  });
  servers.push(server);
  Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", {
    configurable: true,
    value: { apiBaseUrl: server.url.origin },
  });
  const connection = apiClientOptions();
  retainRuntimeCollections(connection);
  connections.push(connection);
  writer = getWriter("board_views")!;
  writer.truncateAndWrite([row("a", 0), row("b", 1), row("c", 2)]);
  markInitialCollectionsSyncComplete();
  return createSharedCollectionViews({
    projectId: "project",
    extensionInstanceId: null,
    localId: "table",
    record: { id: "table" },
  });
};
