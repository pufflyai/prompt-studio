import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { mermaidFixtures } from "@/components/mermaid-renderer/mermaid-fixtures";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { MarkdownEditor } from "./markdown-editor";

const message = `
# MarkdownEditor

This is a rich message rendered from Markdown.

- Supports lists
- Links like [Pufflig](https://pufflig.com)
- Quotes

> A nice quote to demo the Quote node.

| Feature | Supported |
| ------- | --------- |
| Tables  | ✅         |
| Links   | ✅         |
| Lists   | ✅         |

---

## Subheading
Some more text under a subheading.

---

## Table Example

| Name | Value |
| ---- | ----- |
| Foo  | Bar   |
| Baz  | Qux   |

---

# Heading 1

## Heading 2

### Heading 3

This paragraph has **bold**, *italic*, ~~strikethrough~~ text and <u>underline</u>.

Inline link to [Chakra UI](https://chakra-ui.com).

ReferenceLink token examples:
- {{link('$PROJECT/sources/orders.csv')}}
- {{link('$PROJECT/sources/readme.md')}}

---

# Checklists

- [ ] Unchecked todo item
- [x] Completed todo item
- [ ] Another pending task

---

# Nested Lists

- Fruits
  - Apple
  - Banana
  - Orange
- Vegetables
  - Carrot
  - Lettuce

1. First
2. Second
   1. Second.A
   2. Second.B

---

A paragraph above the rule.

---

> This is a blockquote.
> It can span multiple lines.

\\[ G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu} \\]
Where: \\( G_{\\mu\\nu} \\) is the Einstein tensor, which represents the curvature of spacetime. \\( \\Lambda \\) is the cosmological constant. \\( g_{\\mu\\nu} \\) is the metric tensor, which describes the geometry of spacetime. \\( G \\) is the gravitational constant. \\( c \\) is the speed of light in a vacuum. \\( T_{\\mu\\nu} \\) is the stress-energy tensor, which represents the distribution of matter and energy in spacetime.

\\[
\\begin{align}
a + b &= c \\\\
d + e &= f \\\\
g + h &= i
\\end{align}
\\]

---

## Code Blocks

SQL:

\`\`\`sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT id, email
FROM users
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
\`\`\`

Python:

\`\`\`python
def fib(n: int):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

print(list(fib(10)))
\`\`\`
`;

const buildMermaidMessage = (title: string, code: string) => `
# ${title}

\`\`\`mermaid
${code}
\`\`\`
`;

const mermaidMessage = buildMermaidMessage("Mermaid Diagram", mermaidFixtures.ps81Flowchart);
const invalidMermaidMessage = buildMermaidMessage("Broken Mermaid", mermaidFixtures.invalid);
const mermaidEditedMessage = buildMermaidMessage("Mermaid Edit Workflow", mermaidFixtures.ps81Flowchart);

const editableCodeBlockMessage = `
# Code Authoring

Click into the code block below to edit it inline, use the floating toolbar to insert another code block from a cursor position, and use the copy button on the block chrome.

\`\`\`ts
export function greet(name: string) {
  return \`Hello, \${name}\`;
}
\`\`\`
`;

const MermaidEditWorkflowStory = () => {
  const [markdown, setMarkdown] = useState(mermaidEditedMessage);

  return (
    <>
      <MarkdownEditor defaultState={mermaidEditedMessage} isEditable onChange={setMarkdown} />
      <pre data-testid="markdown-editor-output">{markdown}</pre>
    </>
  );
};

const liveShortcutsMessage = `# Live Markdown Shortcuts

Use this editor to exercise live markdown formatting. Try:

- Start a new line and type \`-\` then a space for a bullet list.
- Type \`1.\` then a space for an ordered list.
- Type \`#\`..\`######\` then a space for headings.
- Type \`>\` then a space for a blockquote.
- Wrap text with \`**\`, \`*\`, or \`~~\` for bold, italic, strike.
- Wrap text with backticks for inline code.
- Type \`---\` on its own line for a horizontal rule.
`;

const LiveShortcutsStory = () => {
  const [markdown, setMarkdown] = useState(liveShortcutsMessage);

  return (
    <>
      <MarkdownEditor defaultState={liveShortcutsMessage} isEditable onChange={setMarkdown} />
      <pre data-testid="markdown-editor-output">{markdown}</pre>
    </>
  );
};

const meta: Meta<typeof MarkdownEditor> = {
  title: "Patterns/Editors/Markdown Editor",
  component: MarkdownEditor,
  decorators: [
    (Story) => (
      <ScrollArea height="520px" bg="bg" borderWidth="1px" borderColor="border.subtle">
        <Story />
      </ScrollArea>
    ),
  ],
  parameters: {
    layout: "padded",
  },
  args: {
    debug: false,
    isEditable: true,
    defaultState: message,
  },
  argTypes: {
    defaultState: {
      control: "text",
      description: "Markdown source to render",
    },
    placeholder: {
      control: "text",
      description: "Placeholder text shown when the editor is empty",
    },
    debug: {
      control: "boolean",
      description: "Show Lexical tree for debugging",
    },
  },
};

export default meta;

type Story = StoryObj<typeof MarkdownEditor>;

export const Basic: Story = {};

export const EmptyWithPlaceholder: Story = {
  args: {
    defaultState: "",
    placeholder: "Start writing Markdown...",
  },
};

export const MermaidPreviewAndEdit: Story = {
  args: {
    defaultState: mermaidMessage,
    isEditable: true,
  },
};

export const MermaidEditPreviewWorkflow: Story = {
  tags: ["!manifest"],
  render: () => <MermaidEditWorkflowStory />,
};

export const MermaidSyntaxError: Story = {
  args: {
    defaultState: invalidMermaidMessage,
    isEditable: true,
  },
};

export const MermaidReadOnly: Story = {
  args: {
    defaultState: mermaidMessage,
    isEditable: false,
  },
};

export const MermaidSequenceDiagram: Story = {
  args: {
    defaultState: buildMermaidMessage("Mermaid Sequence Diagram", mermaidFixtures.sequence),
    isEditable: true,
  },
};

export const MermaidStateDiagram: Story = {
  args: {
    defaultState: buildMermaidMessage("Mermaid State Diagram", mermaidFixtures.state),
    isEditable: true,
  },
};

export const MermaidEntityRelationshipDiagram: Story = {
  args: {
    defaultState: buildMermaidMessage("Mermaid Entity Relationship Diagram", mermaidFixtures.er),
    isEditable: true,
  },
};

export const MermaidClassDiagram: Story = {
  args: {
    defaultState: buildMermaidMessage("Mermaid Class Diagram", mermaidFixtures.class),
    isEditable: true,
  },
};

export const MermaidGanttChart: Story = {
  args: {
    defaultState: buildMermaidMessage("Mermaid Gantt Chart", mermaidFixtures.gantt),
    isEditable: true,
  },
};

export const EditableCodeBlocks: Story = {
  args: {
    defaultState: editableCodeBlockMessage,
    isEditable: true,
  },
};

export const LiveMarkdownShortcuts: Story = {
  tags: ["!manifest"],
  render: () => <LiveShortcutsStory />,
};
