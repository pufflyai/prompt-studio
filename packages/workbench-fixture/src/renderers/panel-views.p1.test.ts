import { expect, test } from "bun:test";
import type { NavigationTarget } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { letterPage, letterResource } from "./panel-view-contracts";
import { completeLetter, deleteLetter } from "./panel-views";

for (const from of [undefined, letterResource("draft")])
  test(`letter completion replaces ${from ? "its draft" : "the landing"} through public viewer navigation`, async () => {
    const requests: NavigationTarget[] = [];
    const storage = createMemoryStorage();
    const [ctx, params] = makeCommandArgs({
      storage,
      params: {},
      overrides: { resource: from, navigation: { open: (target) => requests.push(target) } },
    });
    const created = await completeLetter.run(ctx, params);
    expect(requests).toEqual([
      { kind: "viewer", operation: "replace", from, resource: created, ...(!from ? { page: letterPage } : {}) },
    ]);
    expect(await storage.collection("panel-view-letters").get(created.id)).toMatchObject({ id: created.id });
  });

test("deleting a letter reports its resource after deleting its record", async () => {
  const storage = createMemoryStorage();
  const resource = letterResource("A");
  await storage.collection("panel-view-letters").put(resource.id, resource);
  const removed: unknown[] = [];
  await deleteLetter.run(
    ...makeCommandArgs({
      storage,
      params: {},
      overrides: {
        resource,
        resources: {
          removed: async (resource) => {
            expect(await storage.collection("panel-view-letters").get(resource.id)).toBeUndefined();
            removed.push(resource);
          },
        },
      },
    }),
  );
  expect(removed).toEqual([resource]);
});
