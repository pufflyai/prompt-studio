import { expect, test } from "bun:test";
import { quoteYamlScalar, stripFrontmatter, unquoteYamlScalar } from "./frontmatter";

test("quoted scalars round-trip newlines, quotes, and literal escapes", () => {
  for (const value of ["line one\nline two", 'quoted "text"', String.raw`literal\n`, "C:\\files\\notes", "--- inside"])
    expect(unquoteYamlScalar(quoteYamlScalar(value))).toBe(value);
  expect(stripFrontmatter('---\nvalue: "before --- after"\n---\n\nBody')).toBe("\nBody");
});
