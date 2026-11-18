import { expect, test } from "bun:test";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { apiClientOptions } from "@/lib/api";
import { releaseRuntimeCollections, retainRuntimeCollections } from "@/lib/sync/collections";
import { getProjectExtensionQueries } from "./project-extension-queries";
import { useUpgradeProjectExtension } from "./use-project-extensions";

test("adopts the upgrade response before a slow inventory refresh can offer the old upgrade again", async () => {
  const extension = {
    id: "instance-1",
    projectId: "project-1",
    extensionId: "test.notes",
    installedExtensionId: "source-1",
    installName: "notes",
    name: "notes",
    displayName: "Notes",
    version: "1.0.0",
    sourcePath: "/extensions/notes",
    scope: "global",
    status: "loaded",
    lastLoadedAt: null,
    enabled: true,
    config: {},
    canUpgrade: true,
    updateAvailable: false,
  } satisfies ProjectExtensionInstance;
  const upgraded = { ...extension, version: "2.0.0", canUpgrade: false };
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (request) =>
      Response.json(
        request.method === "POST"
          ? { changed: true, extension: upgraded }
          : { login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true },
      ),
  });
  const globals = globalThis as unknown as { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const previous = globals.__PSTDIO_CONFIG__;
  globals.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  const connection = apiClientOptions();
  const owner = retainRuntimeCollections(connection);
  const client = new QueryClient();
  const inventory = getProjectExtensionQueries("project-1", { owner }).extensions;
  inventory.accept({ extensions: [extension], marketplace: [] });
  let mutation!: ReturnType<typeof useUpgradeProjectExtension>;
  const Probe = () => {
    mutation = useUpgradeProjectExtension("project-1");
    return null;
  };
  try {
    renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    await mutation.mutateAsync({ instanceId: extension.id });
    expect(inventory.getSnapshot().data?.extensions[0]).toMatchObject({
      version: "2.0.0",
      canUpgrade: false,
    });
  } finally {
    client.clear();
    await releaseRuntimeCollections(connection);
    globals.__PSTDIO_CONFIG__ = previous;
    await server.stop(true);
  }
});
