import { expect, test } from "bun:test";
import type { ListProjectExtensionsResponse, ProjectExtensionInstance } from "@pstdio/sdk/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
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
    fetch: () => Response.json({ changed: true, extension: upgraded }),
  });
  const globals = globalThis as unknown as { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const previous = globals.__PSTDIO_CONFIG__;
  globals.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  const client = new QueryClient();
  const key = ["project-extensions", "project-1"];
  client.setQueryData(key, { extensions: [extension], marketplace: [] });
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
    expect(client.getQueryData<ListProjectExtensionsResponse>(key)?.extensions[0]).toMatchObject({
      version: "2.0.0",
      canUpgrade: false,
    });
  } finally {
    globals.__PSTDIO_CONFIG__ = previous;
    client.clear();
    await server.stop(true);
  }
});
