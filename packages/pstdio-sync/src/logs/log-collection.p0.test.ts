import { expect, test } from "bun:test";
import { createLogCollection } from "./log-collection";
import { createMemoryLogStore } from "./memory-log-store";

test("a collection captures append value and retry identity before directory registration yields", async () => {
  const memory = createMemoryLogStore({ address: "immutable", writerId: "writer" });
  const log = createLogCollection({
    address: "immutable",
    definition: { name: "runs", writer: "project" },
    scope: "project",
    writerId: async () => "writer",
    directory: async () => [],
    register: async () => {},
    open: async () => memory.store,
    remote: async () => undefined,
    watch: () => () => {},
  });
  const value = { nested: { value: "original" } };
  const options = { id: "original" };
  const pending = log.append(value, options);
  value.nested.value = "mutated";
  options.id = "mutated";
  expect(await pending).toMatchObject({ id: "original", value: { nested: { value: "original" } } });
  expect((await log.read()).entries).toHaveLength(1);
});
