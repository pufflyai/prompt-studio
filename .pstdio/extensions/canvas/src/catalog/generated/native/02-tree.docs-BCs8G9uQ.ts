// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t, t as n } from "./native-document-blocks-9wQwzhjL.ts";
import r, { Tree as i, t as a } from "./renderers.stories-BfEa6uEc.ts";
import { createElement as o } from "react";
import { Fragment as s, jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/renderers/02-tree.docs.mdx
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
			name: "2. Tree"
		}),
		"\n",
		c(r.h1, { children: "Tree renderer" }),
		"\n",
		l(r.p, { children: [c(r.code, { children: "body.kind: \"tree\"" }), " turns structured sections and nodes into the shared workbench tree. The extension describes data\nand actions. Prompt Studio handles indentation, expansion, scrolling, selection, search, drag-and-drop, and pinned\nheader or footer sections."] }),
		"\n",
		c(r.p, { children: "Use it for file explorers, project navigation, grouped commands, nested catalogs, or any list whose parent-child\nshape matters." }),
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
			c(r.code, { children: "body" }),
			" | Returns the main sections and their first node level. |\n| ",
			c(r.code, { children: "header" }),
			" and ",
			c(r.code, { children: "footer" }),
			" | Return sections pinned above or below the scrolling body. |\n| ",
			c(r.code, { children: "children" }),
			" | Loads children when a node expands. Omit it for a fully loaded tree. |\n| ",
			c(r.code, { children: "defaultExpandedSectionIds" }),
			" | Opens named sections on first render. |\n| ",
			c(r.code, { children: "defaultExpandedNodeIds" }),
			" | Opens named nodes on first render. |\n| ",
			c(r.code, { children: "searchable" }),
			" | Adds the native tree search field. |"
		] }),
		"\n",
		c(r.p, { children: "A node action is a normal navigation target. It may open a page, open a panel, or run a command. Keep loading and\ndomain rules in the extension callback. Keep tree interaction in the renderer." })
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
