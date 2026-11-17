import { expect, test } from "bun:test";
import { emptyWorkbenchExtensionMetadata } from "@pstdio/workbench/extensions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLayoutEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { apiClientOptions } from "@/lib/api";
import { getDashboardAccountStatusQuery, getDashboardScopedQueries } from "@/lib/scoped-queries";
import { releaseRuntimeCollections, retainRuntimeCollections } from "@/lib/sync/collections";
import { getProjectExtensionQueries } from "./project-extension-queries";
import { useExtensionMutation } from "./use-extension-mutation";

test("a mutation survives inactive eviction and retains its invocation authority across account and project rerenders", async () => {
  const environment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
    __PSTDIO_CONFIG__?: { apiBaseUrl: string };
  };
  const previousAct = environment.IS_REACT_ACT_ENVIRONMENT;
  const previousConfig = environment.__PSTDIO_CONFIG__;
  const server = Bun.serve({
    port: 0,
    fetch: () => Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true }),
  });
  environment.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const connection = apiClientOptions();
  const owner = retainRuntimeCollections(connection);
  const root = getDashboardScopedQueries(owner);
  const client = new QueryClient();
  const pending = Promise.withResolvers<string>();
  const calls: string[] = [];
  let mutation!: ReturnType<typeof useExtensionMutation<{ instanceId: string }, string>>;
  let renderer: ReactTestRenderer | undefined;
  let completion: Promise<string> | undefined;
  let retireOnCommit = false;
  const Capture = ({ projectId, name }: { projectId: string; name: string }) => {
    mutation = useExtensionMutation(projectId, "fixture", {
      run: async (_value: { instanceId: string }, target) => {
        calls.push(`run:${name}:${target.projectId}`);
        return pending.promise;
      },
      accept: (value) => {
        calls.push(`accept:${name}:${value}`);
      },
    });
    useLayoutEffect(() => {
      if (retireOnCommit) root.setAuthority({ accountId: "retired-before-effect" });
    }, []);
    return null;
  };
  const render = (projectId: string, name: string) => (
    <QueryClientProvider client={client}>
      <Capture projectId={projectId} name={name} />
    </QueryClientProvider>
  );
  try {
    await getDashboardAccountStatusQuery(owner).read();
    root.setAuthority({ accountId: "first" });
    await act(async () => {
      renderer = create(render("project-a", "first"));
    });
    for (let index = 0; index < 140; index++) root.query({ id: `unrelated-${index}`, read: () => index });
    await act(async () => {
      completion = mutation.mutateAsync({ instanceId: "same-instance" });
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
    expect(calls).toEqual(["run:first:project-a"]);
    expect(root.inspect().active).toBe(4);
    root.setAuthority({ accountId: "second" });
    const replacement = getProjectExtensionQueries("project-a", { owner, queries: root });
    replacement.metadata.accept(emptyWorkbenchExtensionMetadata);
    await act(async () => {
      renderer!.update(render("project-b", "second"));
    });
    await act(async () => {
      pending.resolve("first acknowledgement");
      await completion;
    });
    expect(calls).toEqual(["run:first:project-a"]);
    expect(replacement.metadata.getSnapshot().data).toEqual(emptyWorkbenchExtensionMetadata);
    expect(root.inspect().active).toBe(1);
    await act(async () => renderer?.unmount());
    renderer = undefined;
    expect(root.inspect().active).toBe(0);
    retireOnCommit = true;
    await act(async () => {
      renderer = create(render("project-b", "second"));
    });
    await act(async () => {
      await expect(mutation.mutateAsync({ instanceId: "same-instance" })).rejects.toThrow("closed project or account");
    });
    expect(calls).toEqual(["run:first:project-a"]);
  } finally {
    pending.resolve("cleanup");
    await completion;
    await act(async () => renderer?.unmount());
    client.clear();
    await releaseRuntimeCollections(connection);
    await server.stop(true);
    environment.__PSTDIO_CONFIG__ = previousConfig;
    environment.IS_REACT_ACT_ENVIRONMENT = previousAct;
  }
});
