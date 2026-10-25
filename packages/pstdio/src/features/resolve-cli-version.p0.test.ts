import { describe, expect, it } from "bun:test";
import { resolveCliVersion } from "./resolve-cli-version";

describe("resolveCliVersion", () => {
  it("uses the package version when available", () => {
    expect(resolveCliVersion({ packageVersion: "0.1.0" })).toBe("0.1.0");
  });

  it("uses unknown when package version is unavailable", () => {
    expect(resolveCliVersion({ packageVersion: undefined })).toBe("0.0.0-unknown");
  });
});
