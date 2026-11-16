import { expect, test } from "bun:test";
import { createBenchResources } from "./testbench-resources";

test("the testbench numbers single and batched resources from one declared sequence", async () => {
  const resources = await createBenchResources({ ticket: "PS" });

  const first = await resources.allocate({ kind: "ticket" });
  const batch = await resources.allocateMany({ kind: "ticket", count: 2 });

  expect([first, ...batch].map((item) => item.shorthand)).toEqual(["PS-1", "PS-2", "PS-3"]);
  expect((await resources.allocate({ kind: "ticket" })).shorthand).toBe("PS-4");
});
