import { describe, expect, it } from "bun:test";
import { acceptsFile, fileDropValueFromFile, parseAccept } from "./file-accept";

describe("parseAccept", () => {
  it("classifies extension, mime, and wildcard clauses", () => {
    expect(parseAccept("image/*,.png,image/jpeg")).toEqual([
      { kind: "wildcard", value: "image" },
      { kind: "extension", value: ".png" },
      { kind: "mime", value: "image/jpeg" },
    ]);
  });

  it("returns no clauses for an empty accept", () => {
    expect(parseAccept()).toEqual([]);
  });
});

describe("acceptsFile", () => {
  it("accepts anything when accept is empty", () => {
    expect(acceptsFile({ name: "notes.txt" })).toBe(true);
  });

  it("matches by extension", () => {
    expect(acceptsFile({ name: "logo.PNG" }, ".png")).toBe(true);
    expect(acceptsFile({ name: "logo.gif" }, ".png")).toBe(false);
  });

  it("matches by exact mime type", () => {
    expect(acceptsFile({ name: "a", mimeType: "image/jpeg" }, "image/jpeg")).toBe(true);
    expect(acceptsFile({ name: "a", mimeType: "image/png" }, "image/jpeg")).toBe(false);
  });

  it("matches by type/* wildcard", () => {
    expect(acceptsFile({ name: "a", mimeType: "image/webp" }, "image/*")).toBe(true);
    expect(acceptsFile({ name: "a", mimeType: "video/mp4" }, "image/*")).toBe(false);
  });
});

describe("fileDropValueFromFile", () => {
  it("keeps serializable metadata only", () => {
    expect(fileDropValueFromFile({ name: "a.png", type: "image/png", size: 10 })).toEqual({
      name: "a.png",
      mimeType: "image/png",
      size: 10,
      dataUrl: undefined,
    });
  });
});
