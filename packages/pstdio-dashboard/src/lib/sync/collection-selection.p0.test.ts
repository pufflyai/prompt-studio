import { expect, spyOn, test } from "bun:test";
import { createCollectionSelection } from "./collection-selection";
import { createRuntimeCollections } from "./collections";

test("selected collection snapshots ignore unrelated projects and fields but retain membership changes", async () => {
  const owner = createRuntimeCollections();
  const writer = owner.getWriter("sessions")!;
  writer.upsert({ id: "a", project_id: "a", name: "Original", status: "idle" });
  const selected = createCollectionSelection(owner, { tables: ["sessions"], projectId: "a", fields: ["name"] });
  const first = selected.get();
  let notices = 0;
  const stop = selected.subscribe(() => notices++);
  writer.upsert({ id: "b", project_id: "b", name: "Other" });
  writer.upsert({ id: "a", project_id: "a", name: "Original", status: "running" });
  expect(selected.get()).toBe(first);
  expect(notices).toBe(0);
  writer.upsert({ id: "a", project_id: "b", name: "Original", status: "running" });
  expect(selected.get()).toEqual([]);
  expect(notices).toBe(1);
  stop();
  await owner.dispose();
});

test("a selection shares observation and delivers initial-sync completion even for empty rows", async () => {
  const owner = createRuntimeCollections();
  const subscribe = spyOn(owner, "subscribeCollections");
  const selected = createCollectionSelection(owner, { tables: ["projects"] });
  let notices = 0;
  const first = selected.subscribe(() => notices++);
  const second = selected.subscribe(() => notices++);
  expect(subscribe).toHaveBeenCalledTimes(1);
  owner.markInitialCollectionsSyncComplete();
  expect(notices).toBe(2);
  first();
  second();
  const again = selected.subscribe(() => notices++);
  expect(subscribe).toHaveBeenCalledTimes(2);
  again();
  await owner.dispose();
});
