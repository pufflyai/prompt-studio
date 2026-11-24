import { expect, test } from "bun:test";
import type { ResourceAnchorPage } from "@pstdio/sdk/extensions";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { ResourceLinkChangePreview, ResourceLinksService } from "./resource-links-types";
import { useResourceLinkRows } from "./use-resource-link-rows";

test("moving to a new link page detaches a held obsolete reconciliation read", async () => {
  const source = { type: "session", projectId: "project", extensionId: "pstdio", id: "source" };
  const target = { ...source, id: "target" };
  const incoming = { ...source, id: "incoming", label: "Incoming session" };
  const stale = Promise.withResolvers<ResourceAnchorPage>();
  const held = Promise.withResolvers<void>();
  let changes: readonly ResourceLinkChangePreview[] = [];
  let notifyChange: (() => void) | undefined;
  let observation: ((signal: AbortSignal) => Promise<void>) | undefined;
  let listCount = 0;
  const service: ResourceLinksService = {
    async list({ cursor }) {
      listCount++;
      if (cursor) return { items: [{ source, target }] };
      if (listCount === 1) return { items: [], nextCursor: "page-2" };
      held.resolve();
      return stale.promise;
    },
    add: async () => {},
    remove: async () => {},
    resolve: async (resources) => resources.map((resource) => ({ resource })),
    search: async () => [],
    subscribe: () => () => {},
    changes: {
      getSnapshot: () => changes,
      subscribe(listener) {
        notifyChange = listener;
        return () => {
          notifyChange = undefined;
        };
      },
      observe(refresh) {
        observation = refresh;
        return () => {
          observation = undefined;
        };
      },
    },
  };
  let current: ReturnType<typeof useResourceLinkRows>;
  const Probe = ({ cursor }: { cursor?: string }) => {
    current = useResourceLinkRows(service, source, cursor);
    return null;
  };
  let tree: ReactTestRenderer | undefined;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  try {
    await act(async () => {
      tree = create(<Probe />);
    });
    expect(current!.nextCursor).toBe("page-2");
    let retired = false;
    await act(async () => {
      void observation!(new AbortController().signal).then(() => {
        retired = true;
      });
      await held.promise;
    });
    await act(async () => {
      tree!.update(<Probe cursor="page-2" />);
    });
    expect(retired).toBe(true);
    expect(current!.rows.map(({ edge }) => edge.target)).toEqual([target]);
    stale.resolve({ items: [] });
    await act(async () => {
      await stale.promise;
    });
    expect(current!.rows.map(({ edge }) => edge.target)).toEqual([target]);
    await act(async () => {
      changes = [
        { id: Symbol("incoming"), status: "writing", change: { kind: "add", source: incoming, targets: [source] } },
      ];
      notifyChange!();
    });
    expect(current!.rows.map(({ candidate, pending }) => [candidate.resource.id, pending])).toEqual([
      [target.id, undefined],
      [incoming.id, "pending"],
    ]);
    expect(current!.rows[1]?.incoming).toBe(true);
    expect(listCount).toBe(3);
  } finally {
    stale.resolve({ items: [] });
    await act(async () => tree?.unmount());
    if (previous) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", previous);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
