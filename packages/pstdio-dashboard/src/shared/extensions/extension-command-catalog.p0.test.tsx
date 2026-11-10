import { expect, test } from "bun:test";
import { viewDataEvents } from "@pstdio/sdk/extensions";
import { emptyWorkbenchExtensionMetadata } from "@pstdio/workbench/extensions";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { apiClientOptions } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardAccountStatusQuery } from "@/lib/scoped-queries";
import { releaseRuntimeCollections, retainRuntimeCollections } from "@/lib/sync/collections";
import { getProjectExtensionQueries } from "./project-extension-queries";
import { useExecuteExtensionCommand } from "./use-project-extensions";

test("webview reads retain catalogs while catalog-changing commands refresh both projections", async () => {
  const environment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
    __PSTDIO_CONFIG__?: { apiBaseUrl: string };
  };
  const previousAct = environment.IS_REACT_ACT_ENVIRONMENT;
  const previousConfig = environment.__PSTDIO_CONFIG__;
  const reads = { metadata: 0, appearance: 0 };
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/extensions/ui")) {
        reads.metadata++;
        return Response.json(emptyWorkbenchExtensionMetadata);
      }
      if (path.endsWith("/extensions/appearance")) {
        reads.appearance++;
        return Response.json({ themes: [], fileIconThemes: [], translations: [], diagnostics: [] });
      }
      if (path.includes("/extensions/commands/")) {
        const changed = path.includes("change-catalog");
        return Response.json({
          commandId: changed ? "example.command.change-catalog" : "example.command.read-board",
          extensionId: "example",
          outcome: { ok: true, status: "success", value: {} },
          events: changed ? [{ id: viewDataEvents.extensionCatalogChanged.id }] : [],
        });
      }
      return Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true });
    },
  });
  environment.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const connection = apiClientOptions();
  const owner = retainRuntimeCollections(connection);
  const client = getDashboardQueryClient(owner);
  let renderer: ReactTestRenderer | undefined;
  let mutation!: ReturnType<typeof useExecuteExtensionCommand>;
  const Capture = () => {
    mutation = useExecuteExtensionCommand("project", () => {});
    return null;
  };
  const stops: (() => void)[] = [];
  try {
    await getDashboardAccountStatusQuery(owner).read();
    const catalog = getProjectExtensionQueries("project", { owner });
    stops.push(
      catalog.metadata.subscribe(() => {}),
      catalog.appearance.subscribe(() => {}),
    );
    await Promise.all([catalog.metadata.read(), catalog.appearance.read()]);
    await act(async () => {
      renderer = create(
        <QueryClientProvider client={client}>
          <Capture />
        </QueryClientProvider>,
      );
    });
    expect(reads).toEqual({ metadata: 1, appearance: 1 });
    await act(async () => {
      await mutation.mutateAsync({ commandId: "example.command.read-board", body: { params: {} } });
      await catalog.metadata.read();
    });
    expect(reads).toEqual({ metadata: 1, appearance: 1 });
    await act(async () => {
      await mutation.mutateAsync({ commandId: "example.command.change-catalog", body: { params: {} } });
      await Promise.all([catalog.metadata.read(), catalog.appearance.read()]);
    });
    expect(reads).toEqual({ metadata: 2, appearance: 2 });
  } finally {
    await act(async () => renderer?.unmount());
    for (const stop of stops) stop();
    await releaseRuntimeCollections(connection);
    await server.stop(true);
    environment.__PSTDIO_CONFIG__ = previousConfig;
    environment.IS_REACT_ACT_ENVIRONMENT = previousAct;
  }
});
