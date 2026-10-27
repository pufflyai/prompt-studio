// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-ZX3UlLq0.ts";
import i, { EmptyWorkbench as a, t as o } from "./onboarding.stories-B8X6Bf1U.ts";
import { t as s } from "./onboarding-sources-D_wLzQ74.ts";
import { createElement as c } from "react";
import { Fragment as l, jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/00-empty-shell.docs.mdx
function f(t) {
	let i = {
		code: "code",
		h1: "h1",
		h2: "h2",
		li: "li",
		p: "p",
		ul: "ul",
		...t.components
	};
	return d(l, { children: [
		u(n, {
			of: o,
			name: "0. Empty workbench"
		}),
		"\n",
		u(i.h1, { children: "0. Create a workbench" }),
		"\n",
		d(i.p, { children: [
			"This guide is for host application developers. It uses the Core API from ",
			u(i.code, { children: "@pstdio/workbench" }),
			"."
		] }),
		"\n",
		d(i.p, { children: [
			u(i.code, { children: "createWorkbench()" }),
			" creates the platform services. ",
			u(i.code, { children: "Workbench" }),
			" renders those services. An empty workbench has no\npanels because the host and extensions have not contributed anything yet."
		] }),
		"\n",
		d(i.p, { children: [
			"Create one workbench for the lifetime of the host view. Render it inside ",
			u(i.code, { children: "WorkbenchThemeProvider" }),
			"."
		] }),
		"\n",
		u(r, {
			of: a,
			sourceState: "none"
		}),
		"\n",
		u(i.h2, { children: "Complete example" }),
		"\n",
		u(e, {
			code: s.emptyWorkbench,
			language: "tsx"
		}),
		"\n",
		u(i.h2, { children: "What each field means" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [u(i.code, { children: "createWorkbench()" }), " creates one workbench service container. Every registration in the later guides goes through\nthis container."] }),
			"\n",
			u(i.li, { children: "The example calls it once at module scope, so the same container lives as long as the host view." }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "WorkbenchThemeProvider" }), " supplies the theme tokens the workbench components need. Render it once, above the shell."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "Workbench" }), " is the React component that renders the shell layout."] }),
			"\n",
			d(i.li, { children: [
				"The ",
				u(i.code, { children: "workbench" }),
				" prop connects the rendered shell to the service container. The shell shows whatever that container\nholds, which is nothing yet."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "The next guide adds a placeholder without changing the shell." })
	] });
}
function p(e = {}) {
	let { wrapper: t } = e.components || {};
	return t ? u(t, {
		...e,
		children: u(f, { ...e })
	}) : f(e);
}
function m() {
	return c(t, {
		component: p,
		annotations: i
	});
}
export { m as default };
