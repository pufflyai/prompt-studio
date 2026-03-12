import { describe, expect, it } from "bun:test";
import { resolveCliVersion } from "./resolve-cli-version";

describe("resolveCliVersion", () => {
  it("prefers the version already present in the environment", () => {
    expect(resolveCliVersion({ envVersion: "9.8.7", packageVersion: "0.1.0" })).toBe("9.8.7");
  });

  it("falls back to the package version when env version is missing", () => {
    expect(resolveCliVersion({ envVersion: undefined, packageVersion: "0.1.0" })).toBe("0.1.0");
  });

  it("uses unknown when neither env nor package version is available", () => {
    expect(resolveCliVersion({ envVersion: undefined, packageVersion: undefined })).toBe("0.0.0-unknown");
  });
});
