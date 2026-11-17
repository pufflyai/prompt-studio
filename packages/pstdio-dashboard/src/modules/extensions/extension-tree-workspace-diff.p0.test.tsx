import { expect, test } from "bun:test";
import { ChakraProvider, psTheme, TreeList } from "@pstdio/ui";
import { DiffBubble } from "@pstdio/ui/diff";
import { Activity, useLayoutEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeCollections } from "@/lib/sync/collections";
import {
  getDashboardWorkspaceDiffQuery,
  getDashboardWorkspaceDiffSummary,
} from "@/shared/workspaces/workspace-diff-summary-data";
import { ExtensionTreeWorkspaceDiff } from "./extension-tree-workspace-diff";

const until = async (condition: () => boolean) => {
  const deadline = Date.now() + 2_000;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error("Workspace diff did not settle");
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
};

test("a visible cell reacquires current authority and survives hide/show after its query retires", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  let reads = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === "/v1/account")
        return Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true });
      return Response.json({ workspace_id: "authority", additions: ++reads, deletions: 0, file_count: 1 });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  owner.getWriter("workspaces")!.upsert({
    id: "authority",
    project_id: "project",
    execution_kind: "remote",
    provider_state: "ready",
    provider_capabilities_json: { diff: true },
  });
  const root = getDashboardScopedQueries(owner);
  const first = getDashboardWorkspaceDiffQuery("authority", owner, "project");
  const content = (visible: boolean) => (
    <ChakraProvider value={psTheme}>
      <Activity mode={visible ? "visible" : "hidden"}>
        <ExtensionTreeWorkspaceDiff owner={owner} projectId="project" workspaceId="authority" />
      </Activity>
    </ChakraProvider>
  );
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(content(true));
    });
    await act(async () => until(() => first.getSnapshot().data?.additions === 1));
    await act(async () => root.setAuthority({ accountId: "replacement" }));
    const replacement = getDashboardWorkspaceDiffQuery("authority", owner, "project");
    expect(first.isDisposed()).toBe(true);
    expect(replacement.inspect().automaticObservers).toBe(1);
    await act(async () => until(() => replacement.getSnapshot().data?.additions === 2));
    expect(renderer!.root.findByType(DiffBubble).props.additions).toBe(2);
    await act(async () => renderer!.update(content(false)));
    await act(async () => renderer!.update(content(true)));
    await act(async () => until(() => replacement.getSnapshot().data?.additions === 3));
    expect(renderer!.root.findByType(DiffBubble).props.additions).toBe(3);
  } finally {
    await act(async () => renderer?.unmount());
    await owner.dispose();
    await server.stop(true);
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("a runtime retired by a layout effect before first subscription admits no cell work", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  let reads = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === "/v1/account")
        return Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true });
      reads++;
      return Response.json({ workspace_id: "layout", additions: 1, deletions: 0, file_count: 1 });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  owner.getWriter("workspaces")!.upsert({
    id: "layout",
    project_id: "project",
    execution_kind: "remote",
    provider_state: "ready",
    provider_capabilities_json: { diff: true },
  });
  const query = getDashboardWorkspaceDiffQuery("layout", owner, "project");
  let retired: Promise<void> | undefined;
  const RetiringParent = () => {
    useLayoutEffect(() => {
      retired = owner.dispose();
    }, []);
    return (
      <ChakraProvider value={psTheme}>
        <ExtensionTreeWorkspaceDiff owner={owner} projectId="project" workspaceId="layout" />
      </ChakraProvider>
    );
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(<RetiringParent />);
    });
    await retired;
    expect(reads).toBe(0);
    expect(query.inspect().automaticObservers).toBe(0);
    expect(renderer!.root.findAllByType(DiffBubble)).toHaveLength(0);
  } finally {
    await act(async () => renderer?.unmount());
    await owner.dispose();
    await server.stop(true);
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("collapsed sections and ancestors in an actual nonvirtual tree suspend diff observation", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  let reads = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === "/v1/account")
        return Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true });
      reads++;
      return Response.json({ workspace_id: "collapsed", additions: 1, deletions: 0, file_count: 1 });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  owner.getWriter("workspaces")!.upsert({
    id: "collapsed",
    project_id: "project",
    execution_kind: "remote",
    provider_state: "ready",
    provider_capabilities_json: { diff: true },
  });
  const query = getDashboardWorkspaceDiffQuery("collapsed", owner, "project");
  const content = (section: boolean, ancestor: boolean) => (
    <ChakraProvider value={psTheme}>
      <TreeList
        expandedSectionIds={section ? ["workspaces"] : []}
        expandedNodeIds={ancestor ? ["group"] : []}
        sections={[
          {
            id: "workspaces",
            label: "Workspaces",
            nodes: [
              {
                id: "group",
                label: "Group",
                isContainer: true,
                children: [
                  {
                    id: "workspace",
                    label: "Workspace",
                    endContent: (
                      <ExtensionTreeWorkspaceDiff owner={owner} projectId="project" workspaceId="collapsed" />
                    ),
                  },
                ],
              },
            ],
          },
        ]}
      />
    </ChakraProvider>
  );
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(content(false, false));
    });
    expect(query.inspect().automaticObservers).toBe(0);
    expect(reads).toBe(0);
    await act(async () => renderer!.update(content(true, false)));
    expect(query.inspect().automaticObservers).toBe(0);
    await act(async () => renderer!.update(content(true, true)));
    await act(async () => until(() => query.getSnapshot().data?.additions === 1));
    expect(query.inspect().automaticObservers).toBe(1);
    expect(reads).toBe(1);
    await act(async () => renderer!.update(content(false, true)));
    expect(query.inspect().automaticObservers).toBe(0);
    query.invalidate();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(reads).toBe(1);
    await act(async () => renderer!.update(content(true, false)));
    expect(query.inspect().automaticObservers).toBe(0);
  } finally {
    await act(async () => renderer?.unmount());
    await owner.dispose();
    await server.stop(true);
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("a mounted row retires before unmount without recreating its disposed runtime", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  let reads = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === "/v1/account")
        return Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true });
      reads++;
      return Response.json({ workspace_id: "retiring", additions: 1, deletions: 0, file_count: 1 });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  let retiredCollectionReads = 0;
  const getCollection = owner.getCollection;
  owner.getCollection = (table) => {
    if (owner.isDisposed()) retiredCollectionReads++;
    return getCollection(table);
  };
  owner.getWriter("workspaces")!.upsert({
    id: "retiring",
    project_id: "project",
    execution_kind: "remote",
    provider_state: "ready",
    provider_capabilities_json: { diff: true },
  });
  const query = getDashboardWorkspaceDiffQuery("retiring", owner, "project");
  const content = (visible: boolean) => (
    <ChakraProvider value={psTheme}>
      <Activity mode={visible ? "visible" : "hidden"}>
        <ExtensionTreeWorkspaceDiff owner={owner} projectId="project" workspaceId="retiring" />
      </Activity>
    </ChakraProvider>
  );
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(content(true));
    });
    await act(async () => until(() => query.getSnapshot().data?.additions === 1));
    expect(reads).toBe(1);
    await act(async () => owner.dispose());
    await act(async () => renderer!.update(content(false)));
    await act(async () => renderer!.update(content(true)));
    expect(renderer!.root.findAllByType(DiffBubble)).toHaveLength(0);
    expect(query.inspect().automaticObservers).toBe(0);
    expect(reads).toBe(1);
    expect(retiredCollectionReads).toBe(0);
    expect(renderer!.root.findAllByProps({ "data-workspace-diff-id": "retiring" })).toHaveLength(0);
  } finally {
    await act(async () => renderer?.unmount());
    await owner.dispose();
    await server.stop(true);
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("visible tree cells share live totals, retain a surviving peer and reject another project's workspace", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const encoder = new TextEncoder();
  const posted = Promise.withResolvers<string>();
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  let additions = 1;
  let reads = 0;
  let watches = 0;
  const send = (event: string, id: string) =>
    stream.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify({ subscription_id: id, data: {} })}\n\n`));
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true });
      if (path === "/v1/session-stream")
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              stream = controller;
              controller.enqueue(encoder.encode('event: connected\ndata: {"connection_id":"tree"}\n\n'));
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      if (path.endsWith("/subscriptions") && request.method === "POST") {
        watches++;
        posted.resolve(((await request.json()) as { subscription_id: string }).subscription_id);
      }
      if (path.endsWith("/diff-summary")) {
        reads++;
        return Response.json({ workspace_id: "linked", additions, deletions: 0, file_count: 1 });
      }
      return Response.json({});
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  owner.getWriter("workspaces")!.upsert({
    id: "linked",
    project_id: "project",
    execution_kind: "local",
    provider_state: "ready",
    root_path: "/linked",
    provider_capabilities_json: { diff: true },
  });
  const query = getDashboardWorkspaceDiffQuery("linked", owner, "project");
  const content = (first: boolean, second: boolean) => (
    <ChakraProvider value={psTheme}>
      <Activity mode={first ? "visible" : "hidden"}>
        <ExtensionTreeWorkspaceDiff owner={owner} projectId="project" workspaceId="linked" />
      </Activity>
      <Activity mode={second ? "visible" : "hidden"}>
        <ExtensionTreeWorkspaceDiff owner={owner} projectId="project" workspaceId="linked" />
      </Activity>
      <ExtensionTreeWorkspaceDiff owner={owner} projectId="foreign" workspaceId="linked" />
    </ChakraProvider>
  );
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(content(true, true));
    });
    const id = await posted.promise;
    expect(reads).toBe(0);
    expect(query.inspect().automaticObservers).toBe(2);
    expect(
      renderer!.root.findAllByType("span").filter((node) => node.props["data-workspace-diff-state"] === "pending"),
    ).toHaveLength(2);
    await act(async () => {
      send("diff_ready", id);
      await until(() => query.getSnapshot().data?.additions === 1);
    });
    expect(reads).toBe(1);
    expect(watches).toBe(1);
    expect(renderer!.root.findAllByType(DiffBubble).map((bubble) => bubble.props.additions)).toEqual([1, 1]);
    expect(getDashboardWorkspaceDiffSummary("linked", owner)?.additions).toBe(1);
    await act(async () => renderer!.update(content(false, true)));
    expect(query.inspect().automaticObservers).toBe(1);
    additions = 2;
    await act(async () => {
      send("diff_changed", id);
      await until(() => query.getSnapshot().data?.additions === 2);
    });
    expect(reads).toBe(2);
    expect(renderer!.root.findAllByType(DiffBubble).some((bubble) => bubble.props.additions === 2)).toBe(true);
    await act(async () => renderer!.update(content(false, false)));
    expect(query.inspect().automaticObservers).toBe(0);
    query.invalidate();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(reads).toBe(2);
  } finally {
    await act(async () => renderer?.unmount());
    await owner.dispose();
    await server.stop(true);
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
