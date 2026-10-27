// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t, t as n } from "./native-document-blocks-9wQwzhjL.ts";
import r, { File as i, t as a } from "./renderers.stories-DZIvzo6E.ts";
import { createElement as o } from "react";
import { Fragment as s, jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/renderers/06-file.docs.mdx
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
			name: "6. File"
		}),
		"\n",
		c(r.h1, { children: "File renderer" }),
		"\n",
		l(r.p, { children: [
			c(r.code, { children: "body.kind: \"file\"" }),
			" loads a file name and its content. Prompt Studio selects the native Markdown, code, text, or image\nview from that name. When the extension supplies ",
			c(r.code, { children: "save" }),
			", supported text formats become editable and use the shared\ndirty-state flow."
		] }),
		"\n",
		c(r.p, { children: "Use it for ticket Markdown, generated reports, source files, logs, configuration, and image artifacts." }),
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
			c(r.code, { children: "load" }),
			" | Returns ",
			c(r.code, { children: "fileName" }),
			", ",
			c(r.code, { children: "content" }),
			", and optional media metadata for the active resource. |\n| ",
			c(r.code, { children: "save" }),
			" | Receives changed text. Omit it for a read-only preview. |\n| ",
			c(r.code, { children: "refreshEvents" }),
			" | Reloads the active file after named extension events. |\n| ",
			c(r.code, { children: "emptyTitle" }),
			", ",
			c(r.code, { children: "emptyDescription" }),
			" | Explain why the extension returned no file. |"
		] }),
		"\n",
		l(r.p, { children: [
			"Keep storage and transport in ",
			c(r.code, { children: "load" }),
			" and ",
			c(r.code, { children: "save" }),
			". The extension should not choose an editor, track unsaved text, or\nimplement another save prompt."
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
