import { expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { createExtensionQueryObservation } from "./extension-query-observation";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
test("repeated initial metadata failures keep the accepted fallback eligible for project readiness", async () => {
  const root = createScopedQueryClient({ runtimeId: "cold-readiness", extensionId: "pstdio" });
  let completed = 0;
  const values: string[] = [];
  const observer = createExtensionQueryObservation({
    isAvailable: () => !root.isDisposed(),
    query: (projectId) =>
      root.forScope({ projectId }).query({
        id: "metadata",
        read: async () => {
          throw new Error("offline");
        },
      }),
    fallback: () => "fallback",
    apply: (_id, value) => values.push(value),
    onComplete: () => {
      completed++;
    },
  });
  try {
    observer.refresh("project");
    await turn();
    expect(completed).toBe(1);
    observer.refresh("project");
    await turn();
    expect(completed).toBe(2);
    expect(values).toEqual(["fallback"]);
  } finally {
    observer.clear();
    root.dispose();
  }
});

test("a failed readiness refresh retains successful metadata without completing the failed refresh", async () => {
  const root = createScopedQueryClient({ runtimeId: "readiness", extensionId: "pstdio" });
  let calls = 0;
  let completed = 0;
  const values: string[] = [];
  const observer = createExtensionQueryObservation({
    isAvailable: () => !root.isDisposed(),
    query: (projectId) =>
      root.forScope({ projectId }).query({
        id: "metadata",
        read: async () => {
          if (++calls === 1) return "valid";
          throw new Error("offline");
        },
      }),
    fallback: () => "fallback",
    apply: (_id, value) => values.push(value),
    onComplete: () => {
      completed++;
    },
  });
  observer.refresh("project");
  await turn();
  expect(completed).toBe(1);
  observer.refresh("project");
  await turn();
  expect(completed).toBe(1);
  expect(values).toEqual(["valid"]);
  observer.clear();
  root.dispose();
});

test("catalog refresh bursts apply only their latest result and preserve warm A to B to A snapshots", async () => {
  const root = createScopedQueryClient({ runtimeId: "coalescing", extensionId: "pstdio" });
  const first = Promise.withResolvers<string>();
  const second = Promise.withResolvers<string>();
  const values: string[] = [];
  let calls = 0;
  const observer = createExtensionQueryObservation({
    isAvailable: () => !root.isDisposed(),
    query: (projectId) =>
      root.forScope({ projectId }).query({
        id: "metadata",
        read: () => {
          if (++calls === 1) return first.promise;
          if (calls === 2) return second.promise;
          return Promise.resolve(projectId);
        },
      }),
    fallback: () => "fallback",
    apply: (_id, value) => values.push(value),
  });
  observer.refresh("a");
  for (let index = 0; index < 1000; index++) observer.refresh("a");
  expect(calls).toBe(1);
  first.resolve("obsolete");
  await turn();
  expect(calls).toBe(2);
  expect(values).toEqual([]);
  second.resolve("latest");
  await turn();
  expect(values).toEqual(["latest"]);
  observer.clear();
  observer.refresh("b");
  await turn();
  observer.clear();
  observer.refresh("a");
  expect(values.at(-1)).toBe("latest");
  await turn();
  expect(calls).toBe(3);
  observer.clear();
  root.dispose();
});

test("runtime teardown retires an active catalog observation without opening another query", async () => {
  const root = createScopedQueryClient({ runtimeId: "teardown", extensionId: "pstdio" });
  const observer = createExtensionQueryObservation({
    isAvailable: () => !root.isDisposed(),
    query: (projectId) => root.forScope({ projectId }).query({ id: "metadata", read: async () => "value" }),
    fallback: () => "empty",
    apply: () => {},
  });
  observer.refresh("project");
  await turn();
  expect(() => root.dispose()).not.toThrow();
  expect(root.inspect()).toEqual({ active: 0, retained: 0 });
  observer.clear();
});
