import { expect, spyOn, test } from "bun:test";
import * as markdownAst from "./markdown-ast";
import { buildSourceMap, mappedEnd, mappedInsertion, mappedStart } from "./markdown-source-map";

// Caret mapping visits every text span while typing. Identical spans require no syntax analysis.
test("identical Markdown maps every offset directly without reparsing its syntax", () => {
  const source = Array.from(
    { length: 50 },
    (_, index) => `Paragraph ${index}: **bold**, [link](https://example.com), and plain text.`,
  ).join("\n\n");
  const parse = spyOn(markdownAst, "parseMarkdownSource");
  try {
    const map = buildSourceMap(source, source);
    for (let offset = 0; offset <= source.length; offset++) {
      expect(mappedStart(map, offset)).toBe(offset);
      expect(mappedEnd(map, offset)).toBe(offset);
      expect(mappedInsertion(map, offset)).toBe(offset);
    }
    expect(parse).not.toHaveBeenCalled();
  } finally {
    parse.mockRestore();
  }
});
