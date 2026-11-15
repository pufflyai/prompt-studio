import { expect, test } from "bun:test";
import { Activity } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, type ResourceRef, type TreeViewSection } from "../../../core";
import { registerWorkbenchExtensionTreeRenderers } from "../../../extensions/contributions/tree-renderer-contributions";
import { metadata, treeId } from "../../../extensions/contributions/tree-renderer-contributions.fixture";
import { useTreeData } from "./use-tree-data";

test.each([
  "direct",
  "composed",
] as const)("resource presentation enrichment and warm returns share the actual %s tree read", async (topology) => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const held = Promise.withResolvers<TreeViewSection[]>();
  const calls: { resource: ResourceRef; signal?: AbortSignal }[] = [];
  workbench.registerModule({
    id: "resource-read",
    activate: (context) =>
      registerWorkbenchExtensionTreeRenderers({
        workbench: context,
        projectId: "project",
        metadata,
        executeCommand: (_id, body, signal) => {
          calls.push({ resource: (body.params?.renderer as { resource: ResourceRef }).resource, signal });
          return held.promise;
        },
      }),
  });
  const sourceId = topology === "direct" ? treeId : "composed";
  if (topology === "composed") {
    const owner = { kind: "page", id: "ticket", extensionId: "pstdio.lab" } as const;
    workbench.navigationTrees.registerContribution({
      id: "ticket-tree",
      owner,
      sourceExtensionId: "pstdio.lab",
      declarationIndex: 0,
      viewId: treeId,
    });
    workbench.views.registerView({
      id: sourceId,
      title: "Ticket navigation",
      body: {
        kind: "tree",
        getReadKey: ({ resource }) => workbench.navigationTrees.getReadKey(owner, { resource }),
        getBody: (context) => workbench.navigationTrees.getSections(owner, "content", context),
        getChildren: (node, context) => workbench.navigationTrees.getChildren(node, context),
      },
    });
  }
  let current: ReturnType<typeof useTreeData> | undefined;
  const Capture = ({ resource }: { resource: ResourceRef }) => {
    current = useTreeData(workbench, sourceId, resource, undefined, undefined, "ticket");
    return null;
  };
  const resource: ResourceRef = { type: "ticket", id: "one", projectId: "project", extensionId: "pstdio.lab" };
  const enriched = { ...resource, shorthand: "T-1", label: "Resolved ticket", icon: "ticket" };
  const content = (visible: boolean, bound: ResourceRef) => (
    <Activity mode={visible ? "visible" : "hidden"}>
      <Capture resource={bound} />
    </Activity>
  );
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(content(true, resource));
    });
    expect(calls).toHaveLength(1);
    await act(async () => renderer!.update(content(true, enriched)));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.signal?.aborted).toBe(false);
    await act(async () => {
      held.resolve([
        { id: "sessions", nodes: Array.from({ length: 120 }, (_, id) => ({ id: String(id), label: String(id) })) },
      ]);
    });
    expect(current?.body[0]?.nodes).toHaveLength(120);
    await act(async () => renderer!.update(content(false, enriched)));
    await act(async () => renderer!.update(content(true, resource)));
    await act(async () => renderer!.update(content(true, enriched)));
    expect(calls).toHaveLength(1);
    expect(current?.body[0]?.nodes).toHaveLength(120);
    if (topology === "direct") {
      await act(async () => workbench.views.reads.invalidate(treeId));
      expect(calls).toHaveLength(2);
      expect(calls[1]!.resource).toEqual(enriched);
    }
  } finally {
    held.resolve([]);
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("bound document selection and device authority remain separate tree query inputs", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const calls: ResourceRef[] = [];
  workbench.registerModule({
    id: "resource-scope",
    activate: (context) =>
      registerWorkbenchExtensionTreeRenderers({
        workbench: context,
        projectId: "project",
        metadata,
        executeCommand: (_id, body) => {
          const resource = (body.params?.renderer as { resource: ResourceRef }).resource;
          calls.push(resource);
          return [{ id: "selection", nodes: [{ id: resource.metadata?.documentId }] }];
        },
      }),
  });
  let current: ReturnType<typeof useTreeData> | undefined;
  const Capture = ({ resource }: { resource: ResourceRef }) => {
    current = useTreeData(workbench, treeId, resource, undefined, undefined, "ticket");
    return null;
  };
  let resource: ResourceRef = {
    type: "ticket",
    id: "one",
    projectId: "project",
    extensionId: "pstdio.lab",
    metadata: { documentId: "first" },
    device: { ownerId: "owner", id: "device-a", name: "First" },
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(<Capture resource={resource} />);
    });
    expect(current?.body[0]?.nodes[0]?.id).toBe("first");
    resource = { ...resource, metadata: { documentId: "second" } };
    await act(async () => renderer!.update(<Capture resource={resource} />));
    expect(calls).toHaveLength(2);
    expect(current?.body[0]?.nodes[0]?.id).toBe("second");
    resource = { ...resource, device: { ownerId: "peer", id: "device-b", name: "Second" } };
    await act(async () => renderer!.update(<Capture resource={resource} />));
    expect(calls).toHaveLength(3);
    expect(calls[2]!.device).toEqual(resource.device);
  } finally {
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
