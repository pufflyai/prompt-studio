import { describe, expect, test } from "bun:test";
import { checkExtensionApiReleaseStep } from "./extension-api-release-step";

const check = (released: string, current: string, reportChanged = true, onMain = released) =>
  checkExtensionApiReleaseStep({ released, current, reportChanged, onMain });

describe("extension API version between releases", () => {
  test("keeps the released version while the public API is unchanged", () => {
    expect(check("0.4.0", "0.4.0", false)).toEqual([]);
  });

  test("fails when the public API changed but the version did not move", () => {
    const errors = check("0.4.0", "0.4.0");

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("0.4.0");
  });

  test.each([
    ["0.4.0", "0.4.1"],
    ["0.4.0", "0.5.0"],
    ["0.4.0", "1.0.0"],
    ["1.4.2", "1.4.3"],
    ["1.4.2", "1.5.0"],
    ["1.4.2", "2.0.0"],
  ])("allows one step from %s to %s", (released, current) => {
    expect(check(released, current)).toEqual([]);
  });

  test.each([
    ["0.4.0", "0.4.2"],
    ["0.4.0", "0.6.0"],
    ["0.4.0", "0.5.1"],
    ["1.4.2", "3.0.0"],
    ["1.4.2", "1.4.1"],
    ["0.4.0", "0.3.0"],
  ])("refuses a second step since the release: %s to %s", (released, current) => {
    const errors = check(released, current);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(released);
    expect(errors[0]).toContain(current);
  });

  test("refuses a version below the one already on main", () => {
    const errors = check("0.4.0", "0.4.1", true, "0.5.0");

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("0.5.0");
    expect(check("0.4.0", "0.5.0", true, "0.4.1")).toEqual([]);
  });

  test("starts semver at 0.1.0 after the last alpha release", () => {
    expect(check("1.0.0-alpha.14", "0.1.0")).toEqual([]);
    expect(check("1.0.0-alpha.14", "0.2.0")).toHaveLength(1);
  });
});
