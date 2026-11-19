import { expect, test } from "bun:test";
import type { PstdioClient } from "@pstdio/sdk/client";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../core";
import { createChangeStore, installResourceChanges } from "./change-store";

test("rows and tabs share bounded reads and discard stale results after a scoped refresh", async () => {
  const ref = (i: number) => ({ extensionId: "example.notes", projectId: "project", type: "note", id: String(i) });
  const pages: string[][] = [];
  const first = Promise.withResolvers<void>();
  const api: PstdioClient["resourceChanges"] = {
    query: async (_project, refs) => {
      pages.push(refs.map((r) => r.id));
      const stale = pages.length === 1;
      if (stale) await first.promise;
      return refs.map((resource) => ({
        resource,
        stamp: { lineage: "edition", revision: "2" },
        changedSinceSeen: stale,
      }));
    },
    read: async () => {
      throw Error("A list must not read content");
    },
    acknowledge: async () => {
      throw Error("A list must not acknowledge content");
    },
  };
  const store = createChangeStore("project", api, [ref(1)]);
  const seen: boolean[] = [];
  const observe = (resource: ResourceRef) => store.subscribe(resource, () => seen.push(store.changed(resource)));
  const release = Array.from({ length: 53 }, (_, i) => observe(ref(i)));
  release.push(observe(ref(0)));
  await Promise.resolve();
  expect(pages[0]).toHaveLength(50);
  store.refresh((_key, resource) => resource.id === "0");
  first.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(pages.map((p) => p.length)).toEqual([50, 4]);
  expect(store.changed(ref(0))).toBe(false);
  expect(store.changed(ref(1))).toBe(true);
  expect(seen).toHaveLength(49);
  for (const stop of release) stop();
  store.refresh();
  await Promise.resolve();
  expect(pages.length).toBe(2);
  store.dispose();
});

test("an account switch immediately retires the prior reader's dots and held responses", async () => {
  const workbench = createWorkbench();
  const resource = { extensionId: "example.notes", projectId: "project", type: "note", id: "one" };
  let refresh!: (event: { id: string }) => void;
  let calls = 0;
  const held = Promise.withResolvers<void>();
  const registration = installResourceChanges({
    projectId: "project",
    workbench,
    metadata: { resourceChangeProviders: [{ ...resource, refreshEvents: [] }] },
    subscribeRefreshEvents: (listener) => {
      refresh = listener;
      return { dispose() {} };
    },
    resourceChanges: {
      query: async (_project, refs) => {
        const current = ++calls;
        if (current === 2) await held.promise;
        return refs.map((resource) => ({
          resource,
          stamp: { lineage: "edition", revision: "2" },
          changedSinceSeen: current < 3,
        }));
      },
      read: async () => {
        throw Error("No duplicate content read");
      },
      acknowledge: async () => {
        throw Error("Lists never acknowledge");
      },
    },
  });
  const { resourceChangesFor } = await import("./change-store");
  const store = resourceChangesFor(workbench)!;
  const stop = store.subscribe(resource, () => {});
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  try {
    await settle();
    expect(store.changed(resource)).toBe(true);
    store.refresh();
    await settle();
    refresh({ id: "account.changed" });
    expect(store.changed(resource)).toBe(false);
    held.resolve();
    await settle();
    expect(store.changed(resource)).toBe(false);
    expect(calls).toBe(3);
  } finally {
    held.resolve();
    stop();
    registration.dispose();
    await workbench.dispose();
  }
});
