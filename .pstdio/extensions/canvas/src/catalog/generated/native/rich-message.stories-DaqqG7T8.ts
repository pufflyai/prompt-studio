// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./scroll-area-I7hjn89T.ts";
import { t } from "./rich-message-BDq8UfVC.ts";
import { jsx as n } from "react/jsx-runtime";
// packages/ui/src/components/rich-text/rich-message/rich-message.stories.tsx
var r = {
	title: "Patterns/Chat/Rich Message",
	component: t,
	parameters: { layout: "padded" },
	args: {
		debug: !1,
		defaultState: "\n# RichMessage\n\nThis is a rich message rendered from Markdown.\n\n- Supports lists\n- Links like [Pufflig](https://pufflig.com)\n- Quotes\n\n> A nice quote to demo the Quote node.\n\n| Feature | Supported |\n| ------- | --------- |\n| Tables  | ✅         |\n| Links   | ✅         |\n| Lists   | ✅         |\n\n---\n\n## Subheading\nSome more text under a subheading.\n\n---\n\n## Table Example\n\n| Name | Value |\n| ---- | ----- |\n| Foo  | Bar   |\n| Baz  | Qux   |\n\n---\n\n# Heading 1\n\n## Heading 2\n\n### Heading 3\n\nThis paragraph has **bold**, *italic*, ~~strikethrough~~ text and <u>underline</u>.\n\nInline link to [Chakra UI](https://chakra-ui.com).\n\nReferenceLink token examples:\n- {{link('$PROJECT/sources/orders.csv')}}\n- {{link('$PROJECT/sources/readme.md')}}\n\n---\n\n# Nested Lists\n\n- Fruits\n  - Apple\n  - Banana\n  - Orange\n- Vegetables\n  - Carrot\n  - Lettuce\n\n1. First\n2. Second\n   1. Second.A\n   2. Second.B\n\n---\n\nA paragraph above the rule.\n\n---\n\n> This is a blockquote.\n> It can span multiple lines.\n\n\\[ G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu} \\]\nWhere: \\( G_{\\mu\\nu} \\) is the Einstein tensor, which represents the curvature of spacetime. \\( \\Lambda \\) is the cosmological constant. \\( g_{\\mu\\nu} \\) is the metric tensor, which describes the geometry of spacetime. \\( G \\) is the gravitational constant. \\( c \\) is the speed of light in a vacuum. \\( T_{\\mu\\nu} \\) is the stress-energy tensor, which represents the distribution of matter and energy in spacetime.\n\n\\[\n\\begin{align}\na + b &= c \\\\\nd + e &= f \\\\\ng + h &= i\n\\end{align}\n\\]\n\n---\n\n## Code Blocks\n\nSQL:\n\n```sql\nCREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email TEXT NOT NULL UNIQUE,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nSELECT id, email\nFROM users\nWHERE created_at > NOW() - INTERVAL '7 days'\nORDER BY created_at DESC;\n```\n\nPython:\n\n```python\ndef fib(n: int):\n    a, b = 0, 1\n    for _ in range(n):\n        yield a\n        a, b = b, a + b\n\nprint(list(fib(10)))\n```\n"
	},
	argTypes: {
		defaultState: {
			control: "text",
			description: "Markdown source to render"
		},
		debug: {
			control: "boolean",
			description: "Show Lexical tree for debugging"
		}
	}
}, i = { render: (r) => /* @__PURE__ */ n(e, {
	maxH: "36rem",
	borderWidth: "1px",
	borderColor: "border.subtle",
	borderRadius: "md",
	bg: "bg",
	contentProps: { p: "md" },
	children: /* @__PURE__ */ n(t, { ...r })
}) }, a = {
	args: {
		defaultState: [
			Array.from({ length: 120 }, (e, t) => `${t + 1}. City number ${t + 1} has a river.`).join("\n"),
			"A list that starts at a high number:",
			"998. Almost there\n999. Nearly done\n1000. Four-digit marker"
		].join("\n\n"),
		fullWidth: !0
	},
	render: i.render
};
export { i as Basic, a as LongNumberedList, r as default };
