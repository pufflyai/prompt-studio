// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t, t as n } from "./native-document-blocks-ZX3UlLq0.ts";
import r, { Webview as i, t as a } from "./renderers.stories-DZIvzo6E.ts";
import { createElement as o } from "react";
import { Fragment as s, jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/renderers/07-webview.docs.mdx
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
			name: "7. Webview"
		}),
		"\n",
		c(r.h1, { children: "Webview renderer" }),
		"\n",
		l(r.p, { children: [c(r.code, { children: "body.kind: \"webview\"" }), " loads packaged UI in an isolated frame. The extension declares every host capability it needs.\nThe bridge rejects calls outside that list, and the frame receives the active resource and workbench theme."] }),
		"\n",
		c(r.p, { children: "Use it for charts, maps, diagrams, rich editors, media tools, or other interaction the native renderers cannot\ndescribe. A webview costs more to build because the extension owns its full UI, accessibility, loading, and error\nstates." }),
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
			c(r.code, { children: "entry" }),
			" | Packaged module created with ",
			c(r.code, { children: "packageAsset(path, import.meta.url)" }),
			". |\n| ",
			c(r.code, { children: "capabilities" }),
			" | Host operations this view may call, such as commands, notifications, or artifact reads. |\n| ",
			c(r.code, { children: "defineExtensionView" }),
			" | Defines the guest module and its render function. |\n| ",
			c(r.code, { children: "createWebviewClient" }),
			" | Creates the typed bridge client inside the guest. |"
		] }),
		"\n",
		l(r.p, { children: [
			"Grant only the operations the view calls. Put domain work in extension commands, then let the webview call those\ncommands through ",
			c(r.code, { children: "commands.execute" }),
			". This keeps storage and permissions outside the guest UI."
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
