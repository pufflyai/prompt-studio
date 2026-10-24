import { expect, test } from "bun:test";
import { selectApiBaselines } from "./extension-api-baselines";

test("checks each declared API minimum with its first released SDK", () => {
  const releases = [
    { sdk: "0.44.0", api: "0.2.0" },
    { sdk: "0.45.0", api: "0.2.1" },
    { sdk: "0.44.1", api: "0.2.0" },
    { sdk: "0.43.2", api: "0.1.7" },
  ];
  expect(selectApiBaselines("^0.1.7 || ^0.2.0", releases)).toEqual([
    { sdk: "0.43.2", api: "0.1.7" },
    { sdk: "0.44.0", api: "0.2.0" },
  ]);
  expect(() => selectApiBaselines("^0.2.2", releases)).toThrow("0.2.2");
  expect(selectApiBaselines("^0.1.8 || ^0.2.0", releases)).toEqual([{ sdk: "0.44.0", api: "0.2.0" }]);
});
