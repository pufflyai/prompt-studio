import { expect, test } from "bun:test";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { createSharedCollectionViews } from "./collection-views";
import { row } from "./collection-views.test-support";

test("saved collection views retain their runtime for reads, subscriptions, and writes", async () => {
  const requests: { path: string; method: string }[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      requests.push({ path: new URL(request.url).pathname, method: request.method });
      return Response.json({ views: [] });
    },
  });
  const config = Object.getOwnPropertyDescriptor(globalThis, "__PSTDIO_CONFIG__");
  const owners: ReturnType<typeof getRuntimeCollections>[] = [];
  const select = (name: string) => {
    Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", {
      configurable: true,
      value: { apiBaseUrl: `${server.url.origin}/${name}` },
    });
    const owner = getRuntimeCollections();
    owners.push(owner);
    owner.getWriter("board_views")!.truncateAndWrite([{ ...row("same", 0), title: name }]);
    owner.markInitialCollectionsSyncComplete();
    const source = createSharedCollectionViews({
      projectId: "project",
      extensionInstanceId: null,
      localId: "table",
      record: { id: "table" },
    });
    return { owner, source };
  };
  let unsubscribe: (() => void) | undefined;
  try {
    const first = select("first");
    const second = select("second");
    expect(first.source.getSnapshot()!.views[0]!.title).toBe("first");
    expect(second.source.getSnapshot()!.views[0]!.title).toBe("second");
    let notifications = 0;
    unsubscribe = first.source.subscribe(() => notifications++);
    second.owner.getWriter("board_views")!.upsert({ ...row("same", 0), title: "second changed" });
    expect(notifications).toBe(0);
    first.owner.getWriter("board_views")!.upsert({ ...row("same", 0), title: "first changed" });
    expect(notifications).toBe(1);
    expect(first.source.getSnapshot()!.views[0]!.title).toBe("first changed");
    await first.source.getSnapshot()!.onUpdateView!("same", { title: "saved" });
    expect(requests.filter((request) => request.method === "PATCH")).toEqual([
      { path: "/first/v1/projects/project/board-views/same", method: "PATCH" },
    ]);
  } finally {
    unsubscribe?.();
    await Promise.all(owners.map((owner) => owner.dispose()));
    server.stop(true);
    if (config) Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", config);
    else Reflect.deleteProperty(globalThis, "__PSTDIO_CONFIG__");
  }
});
