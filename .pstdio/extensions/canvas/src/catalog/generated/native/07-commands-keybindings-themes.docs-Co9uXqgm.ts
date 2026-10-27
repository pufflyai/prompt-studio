// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-9wQwzhjL.ts";
import { t as i } from "./module-BQkLCofd.ts";
import a, { PageComposition as o, t as s } from "./onboarding.stories-B8X6Bf1U.ts";
import { createElement as c } from "react";
import { Fragment as l, jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/07-commands-keybindings-themes.docs.mdx
function f(t) {
	let a = {
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
			of: s,
			name: "8. Page composition"
		}),
		"\n",
		u(a.h1, { children: "8. Declare the whole page composition" }),
		"\n",
		d(a.p, { children: [
			"A page declares its Main content through ",
			u(a.code, { children: "main" }),
			" and additional panels through ",
			u(a.code, { children: "slots" }),
			". This story renders two workbenches so both compositions remain\nvisible. It does not demonstrate navigation. Story 8 does that."
		] }),
		"\n",
		u(a.p, { children: "The first workbench shows Session details in Main, changed files in the Sidenav, and a session inspector in the\nfull-height Side panel. The second shows Extension Lab in Main, contributions in the Sidenav, and validation output in\nthe bottom Secondary panel." }),
		"\n",
		u(r, {
			of: o,
			sourceState: "none"
		}),
		"\n",
		u(a.h2, { children: "Complete example" }),
		"\n",
		u(e, {
			code: i,
			language: "tsx"
		}),
		"\n",
		u(a.h2, { children: "What each field means" }),
		"\n",
		u(a.p, { children: "The outer setup prepares the workbench:" }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [u(a.code, { children: "createWorkbench({ startPage })" }), " creates the service container and names the page to open first."] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "workbench.modes.registerMode(...)" }),
				" declares each mode. ",
				u(a.code, { children: "id" }),
				" is the mode identity and ",
				u(a.code, { children: "activate" }),
				" runs when the mode\nbecomes active. This example needs no activation work."
			] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "workbench.pageLocations.switchProject(...)" }), " selects the active project and opens that workbench's start page."] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [u(a.code, { children: "registerPage(...)" }), " defines three Views for each page:"] }),
		"\n",
		d(a.ul, { children: [
			"\n",
			u(a.li, { children: "the Main View renders the concrete page content." }),
			"\n",
			u(a.li, { children: "the Sidenav View renders page-specific context." }),
			"\n",
			d(a.li, { children: [
				"the auxiliary View renders in the region chosen by that page. Session uses ",
				u(a.code, { children: "side" }),
				"; Extension Lab uses ",
				u(a.code, { children: "secondary" }),
				"."
			] }),
			"\n",
			d(a.li, { children: [
				"each View ",
				u(a.code, { children: "id" }),
				" is stable. Its matching page slot refers to it."
			] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "title" }), " is the default user-facing label."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "body.kind: \"react\"" }), " allows trusted host code to return React."] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "render" }),
				" receives the render input. ",
				u(a.code, { children: "input.workbench" }),
				" exposes the core services."
			] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [u(a.code, { children: "workbench.pages.registerPage(...)" }), " declares each page and its composition:"] }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [u(a.code, { children: "id" }), " is the stable identity of this page registration."] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "ref" }),
				" is the public page reference ",
				u(a.code, { children: "{ extensionId, kind: \"page\", id }" }),
				". Navigation targets address the page through\nthis value."
			] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "title" }), " is the user-facing page name."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "path" }), " is the URL path segment for the page location."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "modeId" }), " names the mode that owns the page. Opening a page from another mode switches the mode in the same\nnavigation step."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "main: { kind: \"view\", view, cardinality: \"one\" }" }), " renders the Main view."] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "slots" }),
				" declares the fixed Sidenav panel and the additional panel in ",
				u(a.code, { children: "page.auxiliary.region" }),
				". Session uses Side; Extension Lab uses Secondary. Each uses the shared ",
				u(a.code, { children: "item" }),
				" contract."
			] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [
			u(a.code, { children: "PageCompositionExample" }),
			" creates two workbenches with different start pages. It renders both at once so the region\nlayouts can be compared without changing state. ",
			u(a.code, { children: "showNavigation: false" }),
			" removes the replacement controls from this\nstory."
		] }),
		"\n",
		u(a.p, { children: "Do not open page-owned panels from an activation callback. The page registry is the source of truth, so the runtime can\nadd and remove the complete page contribution as one unit." })
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
		annotations: a
	});
}
export { m as default };
