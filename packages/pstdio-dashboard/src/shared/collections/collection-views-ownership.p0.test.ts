import { afterEach, expect, spyOn, test } from "bun:test";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { createSharedCollectionViews } from "./collection-views";
import { cleanup, row, setup, writer } from "./collection-views.test-support";

afterEach(cleanup);

test("duplicate collection views share reads and observation, and ignore another board's rows", async () => {
  const read = Promise.withResolvers<void>();
  let reads = 0;
  const first = setup(
    () => Response.json({}),
    () => {
      reads++;
      read.resolve();
      return [];
    },
  );
  const owner = getRuntimeCollections();
  const subscribe = spyOn(owner, "subscribeCollections");
  const second = createSharedCollectionViews({
    projectId: "project",
    extensionInstanceId: null,
    localId: "table",
    record: { id: "table" },
  });
  expect(second).toBe(first);
  let notifications = 0;
  const stop = first.subscribe(() => notifications++);
  const stopSecond = second.subscribe(() => notifications++);
  await read.promise;
  expect(reads).toBe(1);
  const subscriptionCount = subscribe.mock.calls.length;
  const snapshot = first.getSnapshot();
  writer.upsert({ ...row("foreign", 0), board_id: "other" });
  expect(first.getSnapshot()).toBe(snapshot);
  expect(notifications).toBe(0);
  stop();
  stopSecond();
  const again = first.subscribe(() => notifications++);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(reads).toBe(1);
  expect(subscribe.mock.calls.length).toBe(subscriptionCount + 1);
  again();
});

test("a newer shared order supersedes an acknowledged move while the board is inactive", async () => {
  const source = setup(() => Response.json({}));
  const stop = source.subscribe(() => {});
  await source.getSnapshot()!.onReorderViews!(["c", "a", "b"]);
  stop();
  writer.truncateAndWrite([row("b", 0), row("a", 1), row("c", 2)]);
  const again = source.subscribe(() => {});
  expect(source.getSnapshot()!.views.map((view) => view.id)).toEqual(["b", "a", "c"]);
  again();
});
