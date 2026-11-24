import { describe, expect, test } from "bun:test";
import { codeLanguageFor, pickFileKind } from "./file-kind";

describe("pickFileKind", () => {
  test("uses markdown for prose files and unnamed documents", () => {
    expect(pickFileKind("notes.md", undefined)).toBe("markdown");
    expect(pickFileKind("notes.markdown", undefined)).toBe("markdown");
    expect(pickFileKind("NOTES.MD", undefined)).toBe("markdown");
    expect(pickFileKind("readme.txt", undefined)).toBe("markdown");
    expect(pickFileKind(undefined, undefined)).toBe("markdown");
  });

  test("opens logs, unknown extensions and extensionless files as code", () => {
    for (const fileName of ["test.log", "data.unknown", "LICENSE"]) {
      expect(pickFileKind(fileName, "text/plain")).toBe("code");
      expect(codeLanguageFor(fileName)).toBe("plaintext");
    }
  });

  test("picks code for recognised code extensions", () => {
    expect(pickFileKind("a.ts", undefined)).toBe("code");
    expect(pickFileKind("a.tsx", undefined)).toBe("code");
    expect(pickFileKind("config.json", undefined)).toBe("code");
    expect(pickFileKind("script.py", undefined)).toBe("code");
  });

  test("picks image by extension or mime type", () => {
    expect(pickFileKind("logo.png", undefined)).toBe("image");
    expect(pickFileKind("logo.svg", undefined)).toBe("image");
    expect(pickFileKind("blob", "image/png")).toBe("image");
  });

  test("image mime type wins over a code extension", () => {
    expect(pickFileKind("weird.ts", "image/png")).toBe("image");
  });
});

describe("codeLanguageFor", () => {
  test("maps extensions to monaco languages", () => {
    expect(codeLanguageFor("a.ts")).toBe("typescript");
    expect(codeLanguageFor("a.json")).toBe("json");
    expect(codeLanguageFor("a.py")).toBe("python");
  });

  test("falls back to plaintext for unknown / missing extensions", () => {
    expect(codeLanguageFor("a.unknownext")).toBe("plaintext");
    expect(codeLanguageFor(undefined)).toBe("plaintext");
  });

  test("maps prose file names when Monaco is requested explicitly", () => {
    expect(codeLanguageFor("README.md")).toBe("markdown");
    expect(codeLanguageFor("notes.txt")).toBe("plaintext");
  });
});
