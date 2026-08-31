import { describe, expect, test } from "bun:test";
import { $createParagraphNode, $createTextNode, $getRoot, $isElementNode } from "lexical";
import { createMarkdownSourceDocument } from "./markdown-source-document";
import { $isEquationNode } from "./plugins/EquationPlugin/EquationNode";
import { createHeadlessEditor } from "./transformers/markdown-transformers-test-utils";

const sourceRoundTrip = (markdown: string, edit: () => void) => {
  const editor = createHeadlessEditor();
  const sourceDocument = createMarkdownSourceDocument(markdown);
  let result = "";

  editor.update(() => sourceDocument.importToLexical(), { discrete: true });
  editor.update(edit, { discrete: true });
  editor.read(() => {
    result = sourceDocument.exportFromLexical($getRoot());
  });

  return result;
};

describe("Markdown source document edge cases", () => {
  test("edits a reference-link label without normalizing its source", () => {
    const markdown = [
      "Use [the reference link][studio] without changing its definition.",
      "",
      '[studio]: <https://prompt.studio>  "Prompt Studio"',
    ].join("\n");

    const result = sourceRoundTrip(markdown, () => {
      const label = $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent() === "the reference link");
      label?.setTextContent("the renamed link");
    });

    expect(result).toBe(markdown.replace("the reference link", "the renamed link"));
  });

  test("replaces one of several reference links without rewriting the other", () => {
    const markdown = [
      "Keep [the first link][first] and replace [the second link][second].",
      "",
      '[first]: <https://first.example>  "First"',
      '[second]: https://second.example  "Second"',
    ].join("\n");

    const result = sourceRoundTrip(markdown, () => {
      const paragraph = $getRoot().getFirstChild();
      if (!$isElementNode(paragraph)) return;
      const link = paragraph.getChildren().find((node) => node.getTextContent() === "the second link");
      link?.replace($createTextNode("plain second text"));
    });

    expect(result).toBe(markdown.replace("[the second link][second]", "plain second text"));
  });

  test("replaces several reference links in one paragraph without leaving delimiters", () => {
    const markdown = [
      "Replace [the first link][first] and [the second link][second].",
      "",
      '[first]: <https://first.example>  "First"',
      '[second]: https://second.example  "Second"',
    ].join("\n");

    const result = sourceRoundTrip(markdown, () => {
      const paragraph = $getRoot().getFirstChild();
      if (!$isElementNode(paragraph)) return;
      const links = paragraph.getChildren().filter((node) => node.getType() === "markdown-link");
      links[1]?.replace($createTextNode("plain second text"));
      links[0]?.replace($createTextNode("plain first text"));
    });

    expect(result).toBe(
      markdown
        .replace("[the first link][first]", "plain first text")
        .replace("[the second link][second]", "plain second text"),
    );
  });

  test("replaces a reference link after inserting an earlier block", () => {
    const markdown = [
      "First block.",
      "",
      "Use [the link][project] here.",
      "",
      '[project]: <https://example.com>  "Project"',
    ].join("\n");

    const result = sourceRoundTrip(markdown, () => {
      const linkParagraph = $getRoot().getChildren()[1];
      if (!$isElementNode(linkParagraph)) return;
      linkParagraph.insertBefore($createParagraphNode().append($createTextNode("Inserted block.")));
      const link = linkParagraph.getChildren().find((node) => node.getType() === "markdown-link");
      link?.replace($createTextNode("plain text"));
    });

    expect(result).toBe(
      [
        "First block.",
        "",
        "Inserted block.",
        "",
        "Use plain text here.",
        "",
        '[project]: <https://example.com>  "Project"',
      ].join("\n"),
    );
  });

  test("edits inline code without changing its delimiters", () => {
    const markdown = "Use ``alpha ` beta`` beside &amp; and {{token_with_underscores}}.";

    const result = sourceRoundTrip(markdown, () => {
      const code = $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent().includes("alpha ` beta"));
      code?.setTextContent(code.getTextContent().replace("alpha", "gamma"));
    });

    expect(result).toBe("Use ``gamma ` beta`` beside &amp; and {{token_with_underscores}}.");
  });

  test("edits fenced code without changing its fence", () => {
    const markdown = '~~~ts\nconst token_name = "keep_me";\n~~~\n\nAfter &amp;.';

    const result = sourceRoundTrip(markdown, () => {
      const code = $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent().includes("keep_me"));
      code?.setTextContent(code.getTextContent().replace("keep_me", "changed"));
    });

    expect(result).toBe('~~~ts\nconst token_name = "changed";\n~~~\n\nAfter &amp;.');
  });

  test("edits dollar math without changing its delimiters", () => {
    const markdown = "Before $x + y$ after.";

    const result = sourceRoundTrip(markdown, () => {
      const paragraph = $getRoot().getFirstChild();
      if (!$isElementNode(paragraph)) return;
      const equation = paragraph.getChildren().find($isEquationNode);
      equation?.setEquation("x + z");
    });

    expect(result).toBe("Before $x + z$ after.");
  });

  test("keeps non-BMP Unicode offsets correct after an edit", () => {
    const markdown = "Before 😀 EDIT after {{token_with_underscores}}.";

    const result = sourceRoundTrip(markdown, () => {
      const text = $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent().includes("EDIT"));
      text?.setTextContent(text.getTextContent().replace("EDIT", "CHANGE"));
    });

    expect(result).toBe("Before 😀 CHANGE after {{token_with_underscores}}.");
  });

  test("keeps hard-break spaces after editing the line", () => {
    const markdown = "Edit this line.  \nKeep the next line.";

    const result = sourceRoundTrip(markdown, () => {
      const line = $getRoot().getAllTextNodes()[0];
      line?.setTextContent(line.getTextContent().replace("Edit", "Change"));
    });

    expect(result).toBe("Change this line.  \nKeep the next line.");
  });

  test("keeps a missing final newline after an edit", () => {
    const markdown = "Before.\n\nEdit target.";

    const result = sourceRoundTrip(markdown, () => {
      const target = $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent() === "Edit target.");
      target?.setTextContent("Changed target.");
    });

    expect(result).toBe("Before.\n\nChanged target.");
  });

  test("keeps hidden comments unchanged after a nearby edit", () => {
    const markdown = "Edit target.\n\n<!-- hidden comment: keep   these   spaces -->\n\nAfter.";

    const result = sourceRoundTrip(markdown, () => {
      $getRoot().getAllTextNodes()[0]?.setTextContent("Changed target.");
    });

    expect(result).toBe("Changed target.\n\n<!-- hidden comment: keep   these   spaces -->\n\nAfter.");
  });
});
