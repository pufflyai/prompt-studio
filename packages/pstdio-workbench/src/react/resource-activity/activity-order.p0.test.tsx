import { expect, test } from "bun:test";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import { createMemoryActivity } from "@pstdio/sdk/testing";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench } from "../../core";
import type { ResourceActivityBinding } from "../../core/registries/resources/resource-activity";
import { useResourceActivity } from "./use-resource-activity";

test("activity stays chronological across older pages, live refresh and equal timestamps", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const api = createMemoryActivity();
  let hold = false;
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const resource: ResourceRef = { projectId: "project", extensionId: "owner", type: "note", id: "note" };
  for (let index = 0; index < 55; index++)
    await api.importEntry(resource, {
      entry: { key: String(index), kind: "comment", body: String(index) },
      author: { type: "user", id: "user", name: "User" },
      source: resource,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    });
  const binding: ResourceActivityBinding = {
    capabilities: { comments: true },
    api: {
      ...api,
      query: async (input) => {
        if (hold && !input.cursor) {
          started.resolve();
          await release.promise;
        }
        return api.query(input);
      },
    },
    watch: async (_resource, input) => {
      await new Promise<void>((resolve) => input.signal.addEventListener("abort", () => resolve(), { once: true }));
    },
  };
  let current!: ReturnType<typeof useResourceActivity>;
  const Fixture = () => {
    current = useResourceActivity(workbench, binding, resource, true);
    return null;
  };
  let root: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      root = create(<Fixture />);
    });
    expect(current.items.map((entry) => entry.body)).toEqual(
      Array.from({ length: 50 }, (_, index) => String(index + 5)),
    );
    expect(current.cursor).not.toBeNull();
    hold = true;
    let refreshing: ReturnType<typeof current.refresh>;
    let paging: ReturnType<typeof current.refresh>;
    let reconciling: ReturnType<typeof current.refresh>;
    await act(async () => {
      refreshing = current.refresh();
      await started.promise;
      paging = current.refresh(true);
      reconciling = current.refresh();
    });
    hold = false;
    release.resolve();
    await act(async () => {
      await Promise.all([refreshing, paging, reconciling]);
    });
    expect(current.items.map((entry) => entry.body)).toEqual(Array.from({ length: 55 }, (_, index) => String(index)));
    expect(current.cursor).toBeNull();
    await api.importEntry(resource, {
      entry: { key: "live", kind: "comment", body: "Live" },
      author: { type: "user", id: "user", name: "User" },
      source: resource,
      createdAt: "2026-01-01T00:54:00.000Z",
    });
    await act(async () => {
      await current.refresh();
    });
    expect(current.items).toHaveLength(56);
    expect(current.items.slice(0, 54).map((entry) => entry.body)).toEqual(
      Array.from({ length: 54 }, (_, index) => String(index)),
    );
    const tied = current.items.slice(-2);
    expect(tied.map((entry) => entry.id)).toEqual(tied.map((entry) => entry.id).sort());
  } finally {
    release.resolve();
    await act(async () => root?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
