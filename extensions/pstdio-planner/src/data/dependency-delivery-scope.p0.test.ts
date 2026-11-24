import { expect, test } from "bun:test";
import { fixture } from "../commands/auto-build.fixture";
import { readDependencyDeliveries } from "./dependency-deliveries";

test.each(["ready", "done"])("delivery checks skip attempt history without a deliverable: %s", async (statusId) => {
  const { ctx, storage, ticket } = await fixture();
  const parent = { ...(await ticket("Parent")), statusId };
  const child = await ticket("Child", [parent.id]);
  const reads: string[] = [];
  const query = storage.records.query;
  storage.records.query = async (input) => {
    if (input.index.startsWith("attempt-")) reads.push(input.index);
    return query(input);
  };
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => {
    const records = collection<T>(name);
    return {
      ...records,
      get: async (id: string) => {
        if (name === "planner-attempt-selections") reads.push(`${name}/${id}`);
        return records.get(id);
      },
    };
  };

  expect(await readDependencyDeliveries(ctx, child, [parent, child], new Set(["done"]), "/repo")).toEqual(new Map());
  expect(reads).toEqual([]);
});
