import { describe, expect, test } from "bun:test";
import { normalizeArtifactMountPath, normalizeCliPath } from "./path-normalization";

describe("normalizeCliPath", () => {
  test("returns segments for an array path", () => {
    expect(normalizeCliPath(["tickets", "create"])).toEqual({
      segments: ["tickets", "create"],
      key: "tickets create",
    });
  });

  test("trims and filters empty segments", () => {
    expect(normalizeCliPath(["", " tickets ", "  ", "create"])).toEqual({
      segments: ["tickets", "create"],
      key: "tickets create",
    });
  });

  test("returns null for empty path", () => {
    expect(normalizeCliPath([])).toBeNull();
    expect(normalizeCliPath(["", "  "])).toBeNull();
  });
});

describe("normalizeArtifactMountPath", () => {
  test("accepts simple relative path", () => {
    expect(normalizeArtifactMountPath("tickets")).toBe("tickets");
  });

  test("accepts nested relative path", () => {
    expect(normalizeArtifactMountPath("tickets/active")).toBe("tickets/active");
  });

  test("normalizes backslashes to slashes", () => {
    expect(normalizeArtifactMountPath("tickets\\nested")).toBe("tickets/nested");
  });

  test("strips trailing slash", () => {
    expect(normalizeArtifactMountPath("tickets/")).toBe("tickets");
  });

  test("rejects absolute path", () => {
    expect(normalizeArtifactMountPath("/tmp/things")).toBeNull();
  });

  test("rejects parent escape", () => {
    expect(normalizeArtifactMountPath("../tickets")).toBeNull();
    expect(normalizeArtifactMountPath("..")).toBeNull();
  });

  test("rejects pstdio-prefixed paths (mount path is relative to .pstdio/<namespace>/)", () => {
    expect(normalizeArtifactMountPath(".pstdio/tickets")).toBeNull();
  });

  test("rejects empty path", () => {
    expect(normalizeArtifactMountPath("")).toBeNull();
    expect(normalizeArtifactMountPath(".")).toBeNull();
  });

  test("rejects null bytes", () => {
    expect(normalizeArtifactMountPath("tickets\0evil")).toBeNull();
  });
});
