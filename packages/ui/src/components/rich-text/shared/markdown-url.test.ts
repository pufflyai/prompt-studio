import { describe, expect, test } from "bun:test";
import { resolveMarkdownUrl } from "./markdown-url";

describe("Markdown URL safety", () => {
  test("allows safe direct links and blocks active protocols", () => {
    expect(resolveMarkdownUrl("https://example.com", "link")).toBe("https://example.com");
    expect(resolveMarkdownUrl("../guide.md", "link")).toBe("../guide.md");
    expect(resolveMarkdownUrl("javascript:alert(1)", "link")).toBeNull();
    expect(resolveMarkdownUrl("data:text/html;base64,PHNjcmlwdD4=", "link")).toBeNull();
  });

  test("allows HTTPS and raster data images", () => {
    expect(resolveMarkdownUrl("https://example.com/image.png", "image")).toBe("https://example.com/image.png");
    expect(resolveMarkdownUrl("data:image/png;base64,aGVsbG8=", "image")).toBe("data:image/png;base64,aGVsbG8=");
    expect(resolveMarkdownUrl("http://example.com/image.png", "image")).toBeNull();
    expect(resolveMarkdownUrl("data:image/svg+xml;base64,PHN2Zz4=", "image")).toBeNull();
  });

  test("requires host resolution for relative images and revalidates the result", () => {
    expect(resolveMarkdownUrl("./image.png", "image")).toBeNull();
    expect(resolveMarkdownUrl("./image.png", "image", () => "https://example.com/image.png")).toBe(
      "https://example.com/image.png",
    );
    expect(resolveMarkdownUrl("./image.png", "image", () => "javascript:alert(1)")).toBeNull();
    expect(resolveMarkdownUrl("./image.png", "image", () => null)).toBeNull();
  });
});
