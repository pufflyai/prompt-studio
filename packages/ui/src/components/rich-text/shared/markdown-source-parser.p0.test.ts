import { expect, test } from "bun:test";
import { createMarkdownSourceParser } from "./markdown-source-parser";

test("document analysis retains loaded spellings and releases superseded changing snapshots", () => {
  const parse = createMarkdownSourceParser(["# Loaded ###", "# Loaded"]);
  const loaded = parse("# Loaded ###");
  const baseline = parse("# Loaded");
  const previous = parse("# First edit");
  parse("# Second edit");
  expect(parse("# First edit")).not.toBe(previous);
  expect(parse("# Loaded ###")).toBe(loaded);
  expect(parse("# Loaded")).toBe(baseline);
  expect(createMarkdownSourceParser(["# Loaded ###"])("# Loaded ###")).not.toBe(loaded);
});
