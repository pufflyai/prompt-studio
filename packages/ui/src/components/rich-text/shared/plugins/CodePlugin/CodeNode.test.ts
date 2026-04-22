import { describe, expect, test } from "bun:test";
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from "lexical";
import { editorTransformers } from "../../editor-config";
import { MermaidNode } from "../MermaidPlugin/MermaidNode";
import { $isCodeBlockNode, CodeBlockNode } from "./CodeNode";
import { insertCodeBlockFromSelection, replaceImportedCodeBlocks } from "./code-block-utils";

function createHeadlessEditor() {
  return createEditor({
    nodes: [QuoteNode, LinkNode, HeadingNode, ListNode, ListItemNode, CodeNode, CodeBlockNode, MermaidNode],
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
      replaceImportedCodeBlocks();
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
      replaceImportedCodeBlocks();
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

function exportEditorMarkdown(editor: ReturnType<typeof createHeadlessEditor>) {
  let result = "";

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
    expect(nodeTypes).not.toContain("codeblock");
  });

  test("converts mermaid markdown blocks with mixed-case language", () => {
    const markdown = "```Mermaid\ngraph TD\n  A --> B\n```";
    const nodeTypes = markdownToTopLevelNodeTypes(markdown);

    expect(nodeTypes).toContain("mermaid");
    expect(nodeTypes).not.toContain("code");
    expect(nodeTypes).not.toContain("codeblock");
  });

  test("exports inline edits made to a code block", () => {
    const editor = createHeadlessEditor();

    editor.update(
      () => {
        $convertFromMarkdownString("```ts\nconsole.log('before')\n```", editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.update(
      () => {
        replaceImportedCodeBlocks();
        const codeBlockNode = $getRoot().getFirstChild();

        if ($isCodeBlockNode(codeBlockNode)) {
          codeBlockNode.setCode("console.log('after')");
        }
      },
      { discrete: true },
    );

    const markdown = exportEditorMarkdown(editor);

    expect(markdown).toContain("console.log('after')");
    expect(markdown).not.toContain("console.log('before')");
  });

  test("inserts a code block from the current text selection", () => {
    const editor = createHeadlessEditor();

    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        const text = $createTextNode("const answer = 42;");

        paragraph.append(text);
        $getRoot().append(paragraph);
        text.select(0, text.getTextContentSize());
        insertCodeBlockFromSelection();
      },
      { discrete: true },
    );

    const markdown = exportEditorMarkdown(editor);

    expect(markdown).toContain("```plaintext");
    expect(markdown).toContain("const answer = 42;");
  });

  test("inserts an empty code block at a collapsed selection", () => {
    const editor = createHeadlessEditor();

    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        const text = $createTextNode("hello");

        paragraph.append(text);
        $getRoot().append(paragraph);
        text.selectEnd();
        insertCodeBlockFromSelection();
      },
      { discrete: true },
    );

    expect(exportEditorMarkdown(editor)).toContain("```plaintext\n\n```");
  });
});
