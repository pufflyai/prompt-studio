// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t, t as n } from "./native-document-blocks-9wQwzhjL.ts";
import r, { DataTable as i, t as a } from "./renderers.stories-BfEa6uEc.ts";
import { createElement as o } from "react";
import { Fragment as s, jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/renderers/04-data-table.docs.mdx
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
			name: "4. Data table"
		}),
		"\n",
		c(r.h1, { children: "Data table renderer" }),
		"\n",
		l(r.p, { children: [c(r.code, { children: "body.kind: \"dataTable\"" }), " renders rows against declared columns. The extension owns the query and domain actions.\nPrompt Studio owns column layout, sorting, paging, row selection, loading, and empty states."] }),
		"\n",
		c(r.p, { children: "Use it for service health, inventories, audit records, build lists, or any dense set of records people need to scan\nand compare." }),
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
			c(r.code, { children: "columns" }),
			" | Declares stable column ids, labels, descriptions, and optional value renderers. |\n| ",
			c(r.code, { children: "query" }),
			" | Returns rows and optional paging details. |\n| ",
			c(r.code, { children: "selectionMode" }),
			" | Use ",
			c(r.code, { children: "multiple" }),
			" when actions can operate on several rows. The default is no selection. |\n| ",
			c(r.code, { children: "selectionActions" }),
			" | Commands for the current selected row ids. |\n| ",
			c(r.code, { children: "rowActions" }),
			" | Commands available for one row. |\n| ",
			c(r.code, { children: "onRowActivate" }),
			" | Returns a target to open when the user activates a row. |\n| ",
			c(r.code, { children: "initialPageSize" }),
			", ",
			c(r.code, { children: "pageSizeOptions" }),
			" | Sets the first page size and the choices shown by the workbench. |"
		] }),
		"\n",
		c(r.p, { children: "Choose a column renderer only when the value needs more than plain text. For example, categorical color works for\nhealth or severity and a color scale works for latency or cost." })
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
