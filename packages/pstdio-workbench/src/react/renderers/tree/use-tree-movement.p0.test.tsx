import { expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, type TreeViewSection } from "../../../core";
import { getWorkbenchOperations } from "../../../core/registries/mutations/operations";
import { getWorkbenchQueries } from "../../../core/workbench-queries";
import { useTreeMovement } from "./use-tree-movement";

const sections: TreeViewSection[] = [
  {
    id: "nodes",
    nodes: [
      { id: "source", label: "Scope draft", canDrag: true },
      { id: "target", label: "Folder", collapsible: true, canDrop: true, children: [] },
    ],
  },
];

test("two tree placements preview the same move and retain recovery if its response is lost", async () => {
  const workbench = createWorkbench();
  const operations = getWorkbenchOperations(getWorkbenchQueries(workbench));
  const started = Promise.withResolvers<void>();
  const lost = Promise.withResolvers<void>();
  const calls: string[] = [];
  let first!: ReturnType<typeof useTreeMovement>;
  let peer!: ReturnType<typeof useTreeMovement>;
  let renderer: ReactTestRenderer | undefined;
  const Probe = ({ second }: { second?: boolean }) => {
    const movement = useTreeMovement({
      workbench,
      projectId: "project",
      scope: "same-root",
      body: sections,
      childrenByNodeId: {},
      canMove: () => true,
      onError: () => undefined,
      read: { key: "query", refresh: () => {} },
      async persist(source) {
        calls.push(source);
        started.resolve();
        await lost.promise;
        throw new PstdioConnectionError(new Error("Response lost"));
      },
    });
    if (second) peer = movement;
    else first = movement;
    return null;
  };
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => {
      renderer = create(
        <>
          <Probe />
          <Probe second />
        </>,
      );
    });
    await act(async () => {
      first.moveNode!("source", "target");
      await started.promise;
    });
    const withMove = [{ id: "nodes", nodes: [{ id: "target", children: [{ id: "source" }] }] }];
    expect(first.body).toMatchObject(withMove);
    expect(peer.body).toMatchObject(withMove);
    await act(async () => {
      lost.resolve();
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
    expect(first.body).toEqual(sections);
    expect(peer.body).toEqual(sections);
    expect(operations.getSnapshot().recovery[0]).toMatchObject({
      status: "unknown",
      draft: { sourceId: "source", targetId: "target", position: "inside" },
    });
    await act(async () => peer.moveNode!("source", "target"));
    expect(calls).toEqual(["source"]);
  } finally {
    lost.resolve();
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
