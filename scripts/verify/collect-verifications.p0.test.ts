import { expect, test } from "bun:test";
import { collectVerifications } from "./collect-verifications";

test("collects every independent verification failure before returning the aggregate", async () => {
  const executed: string[] = [];
  const errors = await collectVerifications(
    ["types", "packages", "runtime"].map((id) => ({
      id,
      run: async () => {
        executed.push(id);
        if (id !== "packages") throw new Error(`${id} failed`);
      },
    })),
    () => {},
  );
  expect(executed).toEqual(["types", "packages", "runtime"]);
  expect(errors).toEqual(["types: types failed", "runtime: runtime failed"]);
});

test("P1 alone stops verification after its first independent failure", async () => {
  const executed: string[] = [];
  const errors = await collectVerifications(
    ["types", "packages"].map((id) => ({
      id,
      run: () => {
        executed.push(id);
        throw new Error("failed");
      },
    })),
    () => {},
    "P1",
  );
  expect(errors).toHaveLength(1);
  expect(executed).toEqual(["types"]);
});
