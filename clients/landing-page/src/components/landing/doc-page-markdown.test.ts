import { describe, expect, test } from "bun:test";
import { docPageToMarkdown } from "./doc-page-markdown";

describe("docPageToMarkdown", () => {
  test("serializes every supported document block", () => {
    expect(
      docPageToMarkdown({
        title: "Page title",
        meta: "PAGE META",
        intro: "Page introduction.",
        blocks: [
          { type: "heading", text: "Section" },
          { type: "paragraph", text: "Paragraph with **formatting**." },
          { type: "list", items: ["First", "Second"] },
          { type: "code", code: "bun run example" },
          { type: "quote", text: "A useful note." },
          { type: "image", src: "/example.png", alt: "Example" },
        ],
      }),
    ).toBe(
      [
        "# Page title",
        "PAGE META",
        "Page introduction.",
        "## Section",
        "Paragraph with **formatting**.",
        "- First\n- Second",
        "```\nbun run example\n```",
        "> A useful note.",
        "![Example](/example.png)",
      ].join("\n\n"),
    );
  });
});
