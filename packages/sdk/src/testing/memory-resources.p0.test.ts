import { expect, test } from "bun:test";
import { createMemoryResources } from "./memory-resources";

test("memory resources number a batch consecutively and continue after it", async () => {
  const resources = createMemoryResources({ ticket: "PS" });
  await resources.allocate({ kind: "ticket" });

  const batch = await resources.allocateMany({ kind: "ticket", count: 3, idPrefix: "tk" });

  expect(batch.map((item) => item.shorthand)).toEqual(["PS-2", "PS-3", "PS-4"]);
  expect(batch.every((item) => item.id.startsWith("tk_"))).toBe(true);
  expect((await resources.allocate({ kind: "ticket" })).shorthand).toBe("PS-5");
  await expect(resources.allocateMany({ kind: "ticket", count: 101 })).rejects.toThrow("1 to 100");
});
