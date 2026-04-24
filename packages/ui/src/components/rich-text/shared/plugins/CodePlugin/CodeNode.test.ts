import { describe, expect, test } from "bun:test";
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getRoot, $nodesOfType, createEditor } from "lexical";
import { editorTransformers } from "../../editor-config";
import { MermaidNode } from "../MermaidPlugin/MermaidNode";
import { replaceCodeNodeWithMermaidNode } from "./CodeBlockPlugin";

function createHeadlessEditor() {
  return createEditor({
    nodes: [QuoteNode, LinkNode, HeadingNode, ListNode, ListItemNode, CodeNode, MermaidNode],
  });
}

// Replicates the real editor flow: import markdown → ImportCodeBlocksPlugin converts
// mermaid CodeNode blocks to MermaidNode → export back to markdown
function markdownRoundtrip(markdown: string) {
  const editor = createHeadlessEditor();
  let result = "";

  editor.update(
    () => {
      $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
    },
    { discrete: true },
  );

  // Mimic ImportCodeBlocksPlugin
  editor.update(
    () => {
      const codeNodes = $nodesOfType(CodeNode);
      for (const n of codeNodes) {
        replaceCodeNodeWithMermaidNode(n);
      }
    },
    { discrete: true },
  );

  editor.read(() => {
    result = $convertToMarkdownString(editorTransformers);
  });

  return result;
}

function markdownToTopLevelNodeTypes(markdown: string) {
  const editor = createHeadlessEditor();
  const nodeTypes: string[] = [];

  editor.update(
    () => {
      $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
    },
    { discrete: true },
  );

  editor.update(
    () => {
      const codeNodes = $nodesOfType(CodeNode);
      for (const n of codeNodes) {
        replaceCodeNodeWithMermaidNode(n);
      }
    },
    { discrete: true },
  );

  editor.read(() => {
    nodeTypes.push(
      ...$getRoot()
        .getChildren()
        .map((node) => node.getType()),
    );
  });

  return nodeTypes;
}

describe("CodeNode markdown roundtrip", () => {
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

  test("preserves mermaid fenced code blocks", () => {
    const markdown = "```mermaid\ngraph TD\n  A[Start] --> B[Done]\n```";
    const result = markdownRoundtrip(markdown);

    expect(result).toContain("```mermaid");
    expect(result).toContain("graph TD");
    expect(result).toContain("A[Start] --> B[Done]");
  });

  test("converts mermaid markdown blocks into MermaidNode", () => {
    const markdown = "```mermaid\ngraph TD\n  A --> B\n```";
    const nodeTypes = markdownToTopLevelNodeTypes(markdown);

    expect(nodeTypes).toContain("mermaid");
    expect(nodeTypes).not.toContain("code");
  });

  test("converts mermaid markdown blocks with mixed-case language", () => {
    const markdown = "```Mermaid\ngraph TD\n  A --> B\n```";
    const nodeTypes = markdownToTopLevelNodeTypes(markdown);

    expect(nodeTypes).toContain("mermaid");
    expect(nodeTypes).not.toContain("code");
  });

  test("keeps non-mermaid markdown blocks as Lexical code nodes", () => {
    const markdown = "```ts\nconsole.log('hello')\n```";
    const nodeTypes = markdownToTopLevelNodeTypes(markdown);

    expect(nodeTypes).toContain("code");
    expect(nodeTypes).not.toContain("mermaid");
  });
});
