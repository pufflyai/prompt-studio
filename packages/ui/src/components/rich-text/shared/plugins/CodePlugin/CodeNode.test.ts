import { describe, expect, test } from "bun:test";
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $nodesOfType, createEditor } from "lexical";
import { editorTransformers } from "../../editor-config";
import { CodeBlockNode } from "./CodeNode";

function createHeadlessEditor() {
  return createEditor({
    nodes: [QuoteNode, LinkNode, HeadingNode, ListNode, ListItemNode, CodeNode, CodeBlockNode],
  });
}

// Replicates the real editor flow: import markdown → ImportCodeBlocksPlugin converts
// CodeNode to CodeBlockNode → export back to markdown
function markdownRoundtrip(markdown: string) {
  const editor = createHeadlessEditor();
  let result = "";

  editor.update(
    () => {
      $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
    },
    { discrete: true },
  );

  // Mimic ImportCodeBlocksPlugin: replace CodeNode with CodeBlockNode
  editor.update(
    () => {
      const codeNodes = $nodesOfType(CodeNode);
      for (const n of codeNodes) {
        const lang = n.getLanguage() ?? "plaintext";
        const code = n.getTextContent();
        n.replace(new CodeBlockNode(lang, code));
      }
    },
    { discrete: true },
  );

  editor.read(() => {
    result = $convertToMarkdownString(editorTransformers);
  });

  return result;
}

describe("CodeBlockNode markdown roundtrip", () => {
  test("preserves fenced code blocks", () => {
    const markdown = "```ts\nconsole.log('hello');\n```";
    const result = markdownRoundtrip(markdown);
    expect(result).toContain("```");
    expect(result).toContain("console.log('hello');");
  });

  test("preserves code block language", () => {
    const markdown = "```python\nprint('hello')\n```";
    const result = markdownRoundtrip(markdown);
    expect(result).toContain("python");
    expect(result).toContain("print('hello')");
  });

  test("preserves multiline code blocks", () => {
    const markdown = "```js\nconst a = 1;\nconst b = 2;\nconsole.log(a + b);\n```";
    const result = markdownRoundtrip(markdown);
    expect(result).toContain("const a = 1;");
    expect(result).toContain("const b = 2;");
    expect(result).toContain("console.log(a + b);");
  });

  test("preserves code blocks alongside other content", () => {
    const markdown = "# Title\n\nSome text\n\n```sh\necho hello\n```\n\nMore text";
    const result = markdownRoundtrip(markdown);
    expect(result).toContain("# Title");
    expect(result).toContain("echo hello");
    expect(result).toContain("More text");
  });
});
