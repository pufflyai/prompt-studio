import { expect, test } from "bun:test";
import { createScopedQueryClient } from "../extensions/scoped-query";
import { createQueryLifecycleFixture } from "./query-lifecycle";

test("the reusable source qualifies shared empty reads, subscribe-before-read and a coalesced stale result", async () => {
  const source = createQueryLifecycleFixture<string[]>([]);
  const root = createScopedQueryClient({ runtimeId: "test", extensionId: "example", projectId: "a" });
  const first = root.query(source.descriptor),
    second = root.query(source.descriptor);
  const stops = [first.subscribe(() => {}), second.subscribe(() => {})];
  try {
    await first.read();
    expect(first).toBe(second);
    expect(source.inspect()).toMatchObject({ subscribers: 1, reads: [{ observing: true, value: [] }] });
    const held = source.holdNext();
    source.change(["old"]);
    await held.entered;
    for (let index = 0; index < 100; index++) source.change(["new"]);
    held.release();
    await first.read();
    expect(first.getSnapshot().data).toEqual(["new"]);
    expect(source.inspect().reads).toHaveLength(3);
  } finally {
    for (const stop of stops) stop();
    root.dispose();
    source.close();
  }
  expect(source.inspect().subscribers).toBe(0);
});

test("the reusable source qualifies warm project return, cancellation, late completion and authority retirement", async () => {
  const a = createQueryLifecycleFixture("A"),
    b = createQueryLifecycleFixture("B");
  const root = createScopedQueryClient({ runtimeId: "test", extensionId: "example", accountId: "one" });
  // Root-routed hints retain freshness while the project's optional source is detached.
  const project = (id: string, source: typeof a) =>
    root.forScope({ projectId: id }).query({ ...source.descriptor, subscribe: undefined });
  const one = project("a", a);
  const stop = one.subscribe(() => {});
  await one.read();
  stop();
  const two = project("b", b),
    release = two.subscribe(() => {});
  await two.read();
  release();
  expect(project("a", a)).toBe(one);
  const returned = one.subscribe(() => {});
  expect(one.getSnapshot()).toMatchObject({ data: "A", loading: false, fetching: false });
  expect(a.inspect().reads).toHaveLength(1);
  const held = a.holdNext();
  a.change("obsolete");
  root.invalidate({ type: "reset", projectId: "a" });
  const signal = await held.entered;
  root.setAuthority({ accountId: "two" });
  expect(signal.aborted).toBe(true);
  expect(one.getSnapshot().data).toBeUndefined();
  held.release();
  const replacement = project("a", a);
  a.change("current");
  await replacement.read();
  expect(replacement.getSnapshot().data).toBe("current");
  expect(one.getSnapshot().data).toBeUndefined();
  returned();
  root.dispose();
  a.close();
  b.close();
});
