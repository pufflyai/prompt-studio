// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { m as e, r as t } from "./test-whhQHjQi.ts";
import { t as n } from "./scroll-area-I7hjn89T.ts";
import { t as r } from "./markdown-editor-w_pQ9qpB.ts";
import { t as i } from "./mermaid-fixtures-D9h-mVW_.ts";
import { useState as a } from "react";
import { Box as o } from "@chakra-ui/react";
import { Fragment as s, jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/ui/src/components/rich-text/markdown-editor/markdown-editor-scrolling.play.ts
var u = Array.from({ length: 30 }, (e, t) => `Paragraph ${t + 1}: select this text and scroll to check the formatting menu.`).join("\n\n"), d = async ({ canvasElement: n }) => {
	let r = n.ownerDocument, i = n.querySelector("[contenteditable=\"true\"]"), a = i?.querySelectorAll("p")[5]?.firstChild?.firstChild, o = r.getSelection();
	if (!i || !a || !o) throw Error("The Markdown editor was not rendered.");
	let s = i.parentElement;
	for (; s && (s.scrollHeight <= s.clientHeight || !/auto|scroll/.test(getComputedStyle(s).overflowY));) s = s.parentElement;
	if (!s) throw Error("The story needs a scrolling editor or ancestor.");
	s.scrollTop = 0, i.focus();
	let c = r.createRange();
	c.setStart(a, 0), c.setEnd(a, 11), o.removeAllRanges(), o.addRange(c);
	let l = r.querySelector(".floating-text-format-toolbar");
	if (!l) throw Error("The selection toolbar was not rendered.");
	await e(() => t(l).toHaveClass("active"));
	let u = c.getBoundingClientRect().top, d = l.getBoundingClientRect().top;
	s.scrollTop = 64, await e(() => {
		let e = c.getBoundingClientRect().top - u, n = l.getBoundingClientRect().top - d;
		t(e).toBe(-64), t(Math.abs(n - e)).toBeLessThan(1), t(l).toHaveClass("active");
	}), s.scrollTop = 0, await e(() => t(l.getBoundingClientRect().top).toBe(d));
}, f = "\n# MarkdownEditor\n\nThis is a rich message rendered from Markdown.\n\n- Supports lists\n- Links like [Pufflig](https://pufflig.com)\n- Quotes\n\n> A nice quote to demo the Quote node.\n\n| Feature | Supported |\n| ------- | --------- |\n| Tables  | ✅         |\n| Links   | ✅         |\n| Lists   | ✅         |\n\n---\n\n## Subheading\nSome more text under a subheading.\n\n---\n\n## Table Example\n\n| Name | Value |\n| ---- | ----- |\n| Foo  | Bar   |\n| Baz  | Qux   |\n\n---\n\n# Heading 1\n\n## Heading 2\n\n### Heading 3\n\nThis paragraph has **bold**, *italic*, ~~strikethrough~~ text and <u>underline</u>.\n\nInline link to [Chakra UI](https://chakra-ui.com).\n\nReferenceLink token examples:\n- {{link('$PROJECT/sources/orders.csv')}}\n- {{link('$PROJECT/sources/readme.md')}}\n\n---\n\n# Checklists\n\n- [ ] Unchecked todo item\n- [x] Completed todo item\n- [ ] Another pending task\n\n---\n\n# Nested Lists\n\n- Fruits\n  - Apple\n  - Banana\n  - Orange\n- Vegetables\n  - Carrot\n  - Lettuce\n\n1. First\n2. Second\n   1. Second.A\n   2. Second.B\n\n---\n\nA paragraph above the rule.\n\n---\n\n> This is a blockquote.\n> It can span multiple lines.\n\n\\[ G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu} \\]\nWhere: \\( G_{\\mu\\nu} \\) is the Einstein tensor, which represents the curvature of spacetime. \\( \\Lambda \\) is the cosmological constant. \\( g_{\\mu\\nu} \\) is the metric tensor, which describes the geometry of spacetime. \\( G \\) is the gravitational constant. \\( c \\) is the speed of light in a vacuum. \\( T_{\\mu\\nu} \\) is the stress-energy tensor, which represents the distribution of matter and energy in spacetime.\n\n\\[\n\\begin{align}\na + b &= c \\\\\nd + e &= f \\\\\ng + h &= i\n\\end{align}\n\\]\n\n---\n\n## Code Blocks\n\nSQL:\n\n```sql\nCREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email TEXT NOT NULL UNIQUE,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nSELECT id, email\nFROM users\nWHERE created_at > NOW() - INTERVAL '7 days'\nORDER BY created_at DESC;\n```\n\nPython:\n\n```python\ndef fib(n: int):\n    a, b = 0, 1\n    for _ in range(n):\n        yield a\n        a, b = b, a + b\n\nprint(list(fib(10)))\n```\n", p = (e, t) => `
# ${e}

\`\`\`mermaid
${t}
\`\`\`
`, m = p("Mermaid Diagram", i.ps81Flowchart), h = p("Broken Mermaid", i.invalid), g = p("Mermaid Edit Workflow", i.ps81Flowchart), _ = "\n# Code Authoring\n\nClick into the code block below to edit it inline, use the floating toolbar to insert another code block from a cursor position, and use the copy button on the block chrome.\n\n```ts\nexport function greet(name: string) {\n  return `Hello, ${name}`;\n}\n```\n", v = () => {
	let [e, t] = a(g);
	return /* @__PURE__ */ l(s, { children: [/* @__PURE__ */ c(r, {
		defaultState: g,
		isEditable: !0,
		onChange: t
	}), /* @__PURE__ */ c("pre", {
		"data-testid": "markdown-editor-output",
		children: e
	})] });
}, y = "# Live Markdown Shortcuts\n\nUse this editor to exercise live markdown formatting. Try:\n\n- Start a new line and type `-` then a space for a bullet list.\n- Type `1.` then a space for an ordered list.\n- Type `#`..`######` then a space for headings.\n- Type `>` then a space for a blockquote. Press Shift+Enter to continue it, or Enter to leave it.\n- Wrap text with `**`, `*`, or `~~` for bold, italic, strike.\n- Wrap text with backticks for inline code.\n- Type `---` on its own line for a horizontal rule.\n", b = () => {
	let [e, t] = a(y);
	return /* @__PURE__ */ l(s, { children: [/* @__PURE__ */ c(r, {
		defaultState: y,
		isEditable: !0,
		onChange: t
	}), /* @__PURE__ */ c("pre", {
		"data-testid": "markdown-editor-output",
		children: e
	})] });
}, x = {
	title: "Patterns/Editors/Markdown Editor",
	component: r,
	decorators: [(e) => /* @__PURE__ */ c(n, {
		height: "520px",
		bg: "bg",
		borderWidth: "1px",
		borderColor: "border.subtle",
		children: /* @__PURE__ */ c(e, {})
	})],
	parameters: { layout: "padded" },
	args: {
		debug: !1,
		isEditable: !0,
		defaultState: f
	},
	argTypes: {
		defaultState: {
			control: "text",
			description: "Markdown source to render"
		},
		placeholder: {
			control: "text",
			description: "Placeholder text shown when the editor is empty"
		},
		debug: {
			control: "boolean",
			description: "Show Lexical tree for debugging"
		}
	}
}, S = {}, C = { args: {
	defaultState: "",
	placeholder: "Start writing Markdown..."
} }, w = { args: {
	defaultState: m,
	isEditable: !0
} }, T = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ c(v, {})
}, E = { args: {
	defaultState: h,
	isEditable: !0
} }, D = { args: {
	defaultState: m,
	isEditable: !1
} }, O = { args: {
	defaultState: p("Mermaid Sequence Diagram", i.sequence),
	isEditable: !0
} }, k = { args: {
	defaultState: p("Mermaid State Diagram", i.state),
	isEditable: !0
} }, A = { args: {
	defaultState: p("Mermaid Entity Relationship Diagram", i.er),
	isEditable: !0
} }, j = { args: {
	defaultState: p("Mermaid Class Diagram", i.class),
	isEditable: !0
} }, M = { args: {
	defaultState: p("Mermaid Gantt Chart", i.gantt),
	isEditable: !0
} }, N = { args: {
	defaultState: _,
	isEditable: !0
} }, P = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ c(b, {})
}, F = {
	tags: ["!manifest", "markdown-selection-scroll"],
	args: { defaultState: u },
	render: (e) => /* @__PURE__ */ c(o, {
		height: "360px",
		children: /* @__PURE__ */ c(r, { ...e })
	}),
	play: d
}, I = {
	tags: ["!manifest", "markdown-selection-scroll"],
	args: {
		defaultState: u,
		scrollable: !1
	},
	play: d
}, L = {
	args: {
		defaultState: "",
		isEditable: !0,
		placeholder: "Describe the tool you need...",
		fullWidth: !0
	},
	render: (e) => /* @__PURE__ */ c(o, {
		height: "320px",
		children: /* @__PURE__ */ c(r, { ...e })
	})
};
export { S as Basic, N as EditableCodeBlocks, L as EmptyDocument, C as EmptyWithPlaceholder, P as LiveMarkdownShortcuts, j as MermaidClassDiagram, T as MermaidEditPreviewWorkflow, A as MermaidEntityRelationshipDiagram, M as MermaidGanttChart, w as MermaidPreviewAndEdit, D as MermaidReadOnly, O as MermaidSequenceDiagram, k as MermaidStateDiagram, E as MermaidSyntaxError, I as SelectionToolbarAncestorScroll, F as SelectionToolbarEditorScroll, x as default };
