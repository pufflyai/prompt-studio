// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t, t as n } from "./native-document-blocks-9wQwzhjL.ts";
import r, { ReactView as i, t as a } from "./renderers.stories-DZIvzo6E.ts";
import { createElement as o } from "react";
import { Fragment as s, jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/renderers/01-react.docs.mdx
function u(e) {
	let r = {
		code: "code",
		h1: "h1",
		h2: "h2",
		li: "li",
		ol: "ol",
		p: "p",
		...e.components
	};
	return l(s, { children: [
		c(t, {
			of: a,
			name: "1. React view"
		}),
		"\n",
		c(r.h1, { children: "React view" }),
		"\n",
		l(r.p, { children: [
			c(r.code, { children: "body.kind: \"react\"" }),
			" lets a trusted host render a component for each View instance. The callback receives the\nresolved ",
			c(r.code, { children: "instance" }),
			" and the ",
			c(r.code, { children: "workbench" }),
			". The instance carries its resource, title, section, and placement identity."
		] }),
		"\n",
		c(r.p, { children: "Use it for host-owned UI that needs direct React composition, such as application chrome, a terminal adapter, or a\nnative screen that implements platform behavior. Do not use it for installable tools. Extensions cannot send React\nthrough the extension boundary." }),
		"\n",
		c(n, {
			of: i,
			sourceState: "shown"
		}),
		"\n",
		c(r.h2, { children: "How it works" }),
		"\n",
		l(r.ol, { children: [
			"\n",
			c(r.li, { children: "The host registers a View with a React body." }),
			"\n",
			c(r.li, { children: "A shell placement, mode placement, or page slot references the View." }),
			"\n",
			l(r.li, { children: [
				"The workbench calls ",
				c(r.code, { children: "render" }),
				" for each active placement instance."
			] }),
			"\n",
			c(r.li, { children: "Disposing the owning module removes the View and its placements together." }),
			"\n"
		] }),
		"\n",
		l(r.p, { children: [
			"| Field | Meaning |\n| --- | --- |\n| ",
			c(r.code, { children: "render" }),
			" | Returns React content for one active instance. |\n| ",
			c(r.code, { children: "instance.resource" }),
			" | Domain object bound to this use of the View, when present. |\n| ",
			c(r.code, { children: "instance.config" }),
			" | Serializable input supplied by the placement. |\n| ",
			c(r.code, { children: "workbench" }),
			" | Host commands, navigation, resources, and other Core APIs. |"
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
