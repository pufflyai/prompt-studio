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

test("checks an API minimum that only nightly builds ship with its first nightly SDK", () => {
  const releases = [
    { sdk: "0.44.0-nightly.20261001", api: "0.2.0" },
    { sdk: "0.44.0", api: "0.2.0" },
    { sdk: "0.46.0-nightly.20261024", api: "0.2.2" },
    { sdk: "0.46.0-nightly.20261023", api: "0.2.2" },
  ];
  expect(selectApiBaselines("^0.2.2", releases)).toEqual([{ sdk: "0.46.0-nightly.20261023", api: "0.2.2" }]);
  expect(selectApiBaselines("^0.2.2 || ^0.3.0", releases, "^0.45.0")).toEqual([
    { sdk: "0.46.0-nightly.20261023", api: "0.2.2" },
  ]);
  expect(selectApiBaselines("^0.2.0", releases)).toEqual([{ sdk: "0.44.0", api: "0.2.0" }]);
});

test("an extension can require a newer preview of an API that has no stable SDK yet", () => {
  const releases = [
    { sdk: "0.46.0-preview.sha-a", api: "0.3.0" },
    { sdk: "0.46.0-preview.sha-b", api: "0.3.0" },
  ];
  expect(selectApiBaselines("^0.3.0", releases, "0.46.0-preview.sha-b")).toEqual([releases[1]]);
});

test("a preview dependency cannot bypass a supported stable API baseline", () => {
  const releases = [
    { sdk: "0.46.0", api: "0.3.0" },
    { sdk: "0.47.0-preview.sha-a", api: "0.3.0" },
  ];
  expect(selectApiBaselines("^0.3.0", releases, "0.47.0-preview.sha-a")).toEqual([releases[0]]);
});
