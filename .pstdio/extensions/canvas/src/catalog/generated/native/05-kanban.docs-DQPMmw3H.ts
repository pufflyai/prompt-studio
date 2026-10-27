// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t, t as n } from "./native-document-blocks-9wQwzhjL.ts";
import r, { Kanban as i, t as a } from "./renderers.stories-BfEa6uEc.ts";
import { createElement as o } from "react";
import { Fragment as s, jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/renderers/05-kanban.docs.mdx
function u(e) {
	let r = {
		code: "code",
		h1: "h1",
		h2: "h2",
		p: "p",
		...e.components
	};
	return l(s, { children: [
		c(t, {
			of: a,
			name: "5. Kanban"
		}),
		"\n",
		c(r.h1, { children: "Kanban renderer" }),
		"\n",
		l(r.p, { children: [c(r.code, { children: "body.kind: \"kanban\"" }), " renders rows as a board or list. Attributes define fields that users can group, sort, filter,\nand show on cards. A status attribute may point at a shared status provider, so the board and status settings use the\nsame workflow."] }),
		"\n",
		c(r.p, { children: "Use it for tickets, approval queues, publishing pipelines, leads, or other work that moves between named stages." }),
		"\n",
		c(n, {
			of: i,
			sourceState: "shown"
		}),
		"\n",
		c(r.h2, { children: "How it works" }),
		"\n",
		l(r.p, { children: [
			"| Field | Meaning |\n| --- | --- |\n| ",
			c(r.code, { children: "attributes" }),
			" | Declares status, enum, text, date, number, or user fields. |\n| ",
			c(r.code, { children: "query" }),
			" | Returns rows for the current renderer settings and filters. |\n| ",
			c(r.code, { children: "defaultSettings" }),
			" | Selects board or list mode, grouping, ordering, and visible properties. |\n| ",
			c(r.code, { children: "onAttributeChange" }),
			" | Persists a card edit or a move between columns. |\n| ",
			c(r.code, { children: "onReorder" }),
			" | Persists ordering within a group. |\n| ",
			c(r.code, { children: "createRow" }),
			" | Connects the native create dialog to an extension command. |\n| ",
			c(r.code, { children: "onRowActivate" }),
			" | Returns the page or panel target for an opened card. |"
		] }),
		"\n",
		c(r.p, { children: "The renderer stores each user's view settings. The extension stores domain data. Do not copy board grouping or filter\nstate into the extension unless it changes the query result." }),
		"\n",
		l(r.p, { children: [
			"Card and list property edits appear immediately while ",
			c(r.code, { children: "onAttributeChange" }),
			" saves in the background. Saves run in order.\nIf a save fails, the renderer restores that edit's saved value, keeps later edits visible, and reports the error."
		] })
	] });
}
function d(e = {}) {
	let { wrapper: t } = e.components || {};
	return t ? c(t, {
		...e,
		children: c(u, { ...e })
	}) : u(e);
}
function f() {
	return o(e, {
		component: d,
		annotations: r
	});
}
export { f as default };
