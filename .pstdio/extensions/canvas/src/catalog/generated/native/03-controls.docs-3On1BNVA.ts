// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t, t as n } from "./native-document-blocks-9wQwzhjL.ts";
import r, { Controls as i, t as a } from "./renderers.stories-DZIvzo6E.ts";
import { createElement as o } from "react";
import { Fragment as s, jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/renderers/03-controls.docs.mdx
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
			name: "3. Controls"
		}),
		"\n",
		c(r.h1, { children: "Controls renderer" }),
		"\n",
		l(r.p, { children: [c(r.code, { children: "body.kind: \"controls\"" }), " renders JSON-safe field declarations with the shared parameter editor. The extension loads\nthe fields and current values. It may save each change, apply the full form, reset values, or return a read-only form."] }),
		"\n",
		c(r.p, { children: "Use it for resource properties, extension settings, filters, small creation forms, and inspector menus. It is a poor\nfit for free-form documents or layouts that cannot be described as fields and groups." }),
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
			c(r.code, { children: "query" }),
			" | Returns ",
			c(r.code, { children: "params" }),
			", ",
			c(r.code, { children: "groups" }),
			", ",
			c(r.code, { children: "values" }),
			", and optional ",
			c(r.code, { children: "readOnly" }),
			". |\n| ",
			c(r.code, { children: "onValueChange" }),
			" | Saves one changed field and receives the complete current value map. |\n| ",
			c(r.code, { children: "onApply" }),
			" | Saves the complete form when the user presses Apply. |\n| ",
			c(r.code, { children: "onReset" }),
			" | Restores some or all controls when the user presses Reset. |\n| ",
			c(r.code, { children: "defaultValues" }),
			" | Supplies values when ",
			c(r.code, { children: "query" }),
			" does not return them. |\n| ",
			c(r.code, { children: "emptyTitle" }),
			", ",
			c(r.code, { children: "emptyDescription" }),
			" | Explain why no controls are available. |"
		] }),
		"\n",
		l(r.p, { children: [
			"Omit ",
			c(r.code, { children: "onValueChange" }),
			" for an Apply-style form. Omit both ",
			c(r.code, { children: "onValueChange" }),
			" and ",
			c(r.code, { children: "onApply" }),
			" for read-only properties. The\nworkbench owns field rendering and validation, so the same declaration works in a panel, menu, or overlay."
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
