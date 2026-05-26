import { describe, expect, it } from "bun:test";
import {
  getDiffLineCount,
  isBinaryDiffPath,
  isGeneratedDiffPath,
  isImageDiffPath,
  isLargeDiffContent,
  LARGE_DIFF_LINE_THRESHOLD,
} from "./diff-size";

describe("isLargeDiffContent", () => {
  it("classifies diffs over 1000 changed lines as large", () => {
    expect(isLargeDiffContent({ additions: LARGE_DIFF_LINE_THRESHOLD + 1 })).toBe(true);
  });

  it("keeps diffs at 1000 changed lines eligible for eager loading", () => {
    expect(isLargeDiffContent({ additions: LARGE_DIFF_LINE_THRESHOLD })).toBe(false);
  });

  it("counts changed lines only", () => {
    expect(getDiffLineCount({ additions: 19, deletions: 19, newContent: "one\ntwo\n" })).toBe(38);
  });

  it("keeps a small edit in a huge file eligible for eager loading", () => {
    const content = Array.from({ length: LARGE_DIFF_LINE_THRESHOLD + 1 }, (_, index) => `line ${index}`).join("\n");

    expect(isLargeDiffContent({ additions: 19, deletions: 19, oldContent: content, newContent: content })).toBe(false);
  });
});

describe("isGeneratedDiffPath", () => {
  it("detects common lockfiles and generated bundles", () => {
    expect(isGeneratedDiffPath("package-lock.json")).toBe(true);
    expect(isGeneratedDiffPath("apps/web/pnpm-lock.yaml")).toBe(true);
    expect(isGeneratedDiffPath("dist/app.min.js")).toBe(true);
  });

  it("keeps normal source files eligible for automatic loading", () => {
    expect(isGeneratedDiffPath("src/app.ts")).toBe(false);
  });
});

describe("isBinaryDiffPath", () => {
  it("flags common image formats as binary", () => {
    expect(isBinaryDiffPath("assets/logo.png")).toBe(true);
    expect(isBinaryDiffPath("photo.JPG")).toBe(true);
    expect(isBinaryDiffPath("anim.gif")).toBe(true);
  });

  it("flags common binary blobs that cannot diff as text", () => {
    expect(isBinaryDiffPath("docs/spec.pdf")).toBe(true);
    expect(isBinaryDiffPath("public/fonts/inter.woff2")).toBe(true);
    expect(isBinaryDiffPath("bundle.wasm")).toBe(true);
  });

  it("does not flag SVG since it is text-based", () => {
    expect(isBinaryDiffPath("icons/check.svg")).toBe(false);
  });

  it("does not flag source files", () => {
    expect(isBinaryDiffPath("src/app.ts")).toBe(false);
    expect(isBinaryDiffPath("README")).toBe(false);
  });
});

describe("isImageDiffPath", () => {
  it("flags image formats", () => {
    expect(isImageDiffPath("logo.png")).toBe(true);
    expect(isImageDiffPath("hero.webp")).toBe(true);
  });

  it("does not flag non-image binaries", () => {
    expect(isImageDiffPath("docs/spec.pdf")).toBe(false);
    expect(isImageDiffPath("bundle.wasm")).toBe(false);
  });
});
