// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t } from "./native-document-blocks-9wQwzhjL.ts";
import n, { t as r } from "./renderers.stories-BfEa6uEc.ts";
import { createElement as i } from "react";
import { Fragment as a, jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/renderers/00-overview.docs.mdx
function c(e) {
	let n = {
		code: "code",
		h1: "h1",
		h2: "h2",
		p: "p",
		pre: "pre",
		...e.components
	};
	return s(a, { children: [
		o(t, {
			of: r,
			name: "0. Choose a renderer"
		}),
		"\n",
		o(n.h1, { children: "Choose a renderer" }),
		"\n",
		s(n.p, { children: [
			"A View defines content. Its ",
			o(n.code, { children: "body.kind" }),
			" selects how Prompt Studio renders that content. A page or placement then gives\nthe View a region and a lifetime. Renderer code should not choose its own region or open itself."
		] }),
		"\n",
		o(n.pre, { children: o(n.code, {
			className: "language-text",
			children: "extension data or trusted host code\n  -> View body\n  -> workbench renderer\n  -> page or placement instance\n"
		}) }),
		"\n",
		o(n.h2, { children: "Renderer guide" }),
		"\n",
		s(n.p, { children: [
			"| Body kind | Who can use it | Your code supplies | Good uses |\n| --- | --- | --- | --- |\n| ",
			o(n.code, { children: "react" }),
			" | Core hosts | A React render function | Host chrome, native adapters, trusted application screens |\n| ",
			o(n.code, { children: "tree" }),
			" | Core and extensions | Sections, nodes, children, and actions | File trees, navigation, grouped catalogs |\n| ",
			o(n.code, { children: "controls" }),
			" | Core and extensions | Form fields, current values, and save callbacks | Properties, settings, filters, creation forms |\n| ",
			o(n.code, { children: "dataTable" }),
			" | Core and extensions | Columns, rows, paging, and row actions | Service lists, inventories, audit records |\n| ",
			o(n.code, { children: "kanban" }),
			" | Core and extensions | Attributes, rows, statuses, and mutations | Ticket boards, review queues, content pipelines |\n| ",
			o(n.code, { children: "file" }),
			" | Core and extensions | Load and optional save callbacks | Markdown, source code, text, images |\n| ",
			o(n.code, { children: "webview" }),
			" | Extensions | A packaged UI entry and requested capabilities | Charts, maps, editors, and other custom interaction |"
		] }),
		"\n",
		s(n.p, { children: [
			"Start with a native renderer. It gives the tool the same keyboard, theme, loading, empty, and error behavior as the\nrest of the workbench. Use a webview when none of the native data models fit. Use ",
			o(n.code, { children: "react" }),
			" only for trusted host code."
		] }),
		"\n",
		o(n.p, { children: "Each renderer page runs the source shown under its preview." })
	] });
}
function l(e = {}) {
	let { wrapper: t } = e.components || {};
	return t ? o(t, {
		...e,
		children: o(c, { ...e })
	}) : c(e);
}
function u() {
	return i(e, {
		component: l,
		annotations: n
	});
}
export { u as default };
