import { expect, test } from "bun:test";
import { parseChatLink } from "./chat-link";

test("parses original file destinations and source locations", () => {
  for (const [source, path, position] of [
    ["README.md", "README.md", undefined],
    ["README.md:12", "README.md", { line: 12 }],
    ["LICENSE:12", "LICENSE", { line: 12 }],
    ["LICENSE", "LICENSE", undefined],
    ["docs/My%20File.md", "docs/My File.md", undefined],
    ["src/a.ts:12:4", "src/a.ts", { line: 12, column: 4 }],
    ["src/a.ts#L12-L18", "src/a.ts", { line: 12, endLine: 18 }],
    ["C:\\repo\\src\\a.ts:12", "C:/repo/src/a.ts", { line: 12 }],
    ["file:///repo/src/a.ts", "/repo/src/a.ts", undefined],
    ["$PROJECT/src/a.ts", "src/a.ts", undefined],
    ["docs/a%23b%25.md", "docs/a#b%.md", undefined],
  ] as const) {
    expect(parseChatLink({ source, origin: "markdown" })).toEqual({
      kind: "file",
      path,
      ...(position ? { position } : {}),
    });
  }
});

test("recognizes inline file intent without linking code lookalikes", () => {
  for (const source of ["LICENSE", "v1.2.3", "@pstdio/ui", "hello()", "foo.bar()"])
    expect(parseChatLink({ source, origin: "inline-code" })).toBeUndefined();
  for (const source of ["README.md", "src/a.ts", "./LICENSE", "src/Dockerfile"])
    expect(parseChatLink({ source, origin: "inline-code" })?.kind).toBe("file");
});

test("keeps canonical and external links distinct and blocks unsafe schemes", () => {
  expect(parseChatLink({ source: "/projects/p/workspace?document=a", origin: "markdown" })?.kind).toBe("page");
  expect(parseChatLink({ source: "https://example.com/projects/p", origin: "markdown" })?.kind).toBe("external");
  for (const source of [
    "javascript:alert(1)",
    "vscode://file/a",
    "pstdio://extension-resource/ticket/a",
    "file://server/share/a.ts",
    "\\\\server\\a.ts",
    "~/a.ts",
    "src/a.ts#other",
    "src/a.ts:0",
    "src/a.ts:2:0",
  ])
    expect(parseChatLink({ source, origin: "markdown" })?.kind).toBe("invalid");
});

test("classifies same-origin dashboard URLs before resolving their pages", () => {
  expect(
    parseChatLink({ source: "https://dashboard.test/projects/p/unknown", origin: "markdown" }, "https://dashboard.test")
      ?.kind,
  ).toBe("page");
  expect(
    parseChatLink({ source: "https://external.test/projects/p/unknown", origin: "markdown" }, "https://dashboard.test")
      ?.kind,
  ).toBe("external");
});
