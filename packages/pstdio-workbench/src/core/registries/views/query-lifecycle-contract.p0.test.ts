import { expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { createQueryLifecycleFixture } from "@pstdio/sdk/testing";
import { createRendererReadRegistry, type RendererReadRequest } from "./renderer-read-registry";

test("the native adapter runs the public shared-source lifecycle fixture without duplicate observation or stale publication", async () => {
  const source = createQueryLifecycleFixture<string[]>([]);
  const queries = createScopedQueryClient({ runtimeId: "native", projectId: "a", extensionId: "example" });
  const registry = createRendererReadRegistry({ queries });
  const first = registry.bind("one"),
    second = registry.bind("two");
  const accepted = Promise.withResolvers<void>();
  const values: string[][] = [];
  const request: RendererReadRequest<string[]> = {
    queryKey: "same",
    sourceId: "contract",
    subscribe: source.descriptor.subscribe,
    load: source.descriptor.read,
    onValue: (value) => {
      values.push(value);
      if (value[0] === "new") accepted.resolve();
    },
    onError: accepted.reject,
  };
  try {
    await Promise.all([first.request(request, "observe"), second.request(request, "observe")]);
    expect(values).toEqual([[], []]);
    expect(source.inspect()).toMatchObject({ subscribers: 1, reads: [{ observing: true, value: [] }] });
    const held = source.holdNext();
    source.change(["old"]);
    await held.entered;
    for (let index = 0; index < 100; index++) source.change(["new"]);
    held.release();
    await accepted.promise;
    expect(values).not.toContainEqual(["old"]);
    expect(source.inspect().reads).toHaveLength(3);
  } finally {
    source.close();
    first.dispose();
    second.dispose();
    await registry.dispose();
    queries.dispose();
  }
  expect(source.inspect().subscribers).toBe(0);
});
