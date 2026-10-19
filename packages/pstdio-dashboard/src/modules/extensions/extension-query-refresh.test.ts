import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { QueryObserver } from "@tanstack/react-query";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks } from "./module-test-fixtures";

for (const table of ["extension_instances", "installed_extension_sources"] as const) {
  test(`refreshes observed harness availability after ${table} changes without an open settings panel`, async () => {
    const projectId = `query-refresh-${table}`;
    const owner = getRuntimeCollections();
    const queryClient = getDashboardQueryClient(owner);
    const queryKey = ["agents-info", projectId];
    let available = ["example.remote.harness.helper"];
    queryClient.setQueryData(queryKey, available);
    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn: async () => available,
      staleTime: Number.POSITIVE_INFINITY,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    const workbench = createWorkbench();
    selectDashboardProject(workbench, { id: projectId, name: "Query refresh" });
    const extensions = workbench.registerModule(
      createExtensionsModule({
        loadAppearance: async () => emptyAppearance,
        loadMetadata: async () => emptyDashboardExtensionMetadata,
      }),
    );
    owner.getCollection(table);
    const writer = owner.getWriter(table)!;
    try {
      await flushMicrotasks();
      available = [];
      writer.upsert({ id: projectId });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(observer.getCurrentResult().data).toEqual([]);
      available = ["example.remote.harness.helper"];
      writer.upsert({ id: projectId, enabled: true });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(observer.getCurrentResult().data).toEqual(available);
    } finally {
      extensions.dispose();
      unsubscribe();
      observer.destroy();
      queryClient.removeQueries({ queryKey });
      writer.remove(projectId);
    }
  });
}
