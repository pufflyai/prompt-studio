// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-9wQwzhjL.ts";
import { t as i } from "./module-BQkLCofd.ts";
import a, { PageReplacement as o, t as s } from "./onboarding.stories-B8X6Bf1U.ts";
import { createElement as c } from "react";
import { Fragment as l, jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/08-focus-context.docs.mdx
function f(t) {
	let a = {
		code: "code",
		h1: "h1",
		h2: "h2",
		li: "li",
		p: "p",
		strong: "strong",
		ul: "ul",
		...t.components
	};
	return d(l, { children: [
		u(n, {
			of: s,
			name: "9. Page replacement"
		}),
		"\n",
		u(a.h1, { children: "9. Replace one page with another" }),
		"\n",
		d(a.p, { children: [
			"Press ",
			u(a.strong, { children: "Open Extension Lab" }),
			". The Session page's Main, Sidenav, and full-height Side panel disappear. The Extension Lab\npage replaces them with Main, Sidenav, and a bottom Secondary panel. Page navigation replaces content and panel\ngeometry instead of leaving the old page's panels behind."
		] }),
		"\n",
		u(a.p, { children: "All callers use the same page-location controller. The controller owns cleanup, mode activation, page composition,\nbreadcrumbs, and the browser location." }),
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
		u(a.p, { children: "The setup creates the workbench and two modes:" }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "createWorkbench({ startPage })" }),
				" creates one workbench service container. ",
				u(a.code, { children: "startPage" }),
				" names the page to open when a\nproject loads without a saved location."
			] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "sessionPage" }),
				" and ",
				u(a.code, { children: "labPage" }),
				" are ",
				u(a.code, { children: "PageRef" }),
				" values: ",
				u(a.code, { children: "{ extensionId, kind: \"page\", id }" }),
				". A ",
				u(a.code, { children: "PageRef" }),
				" is the typed\nreference that navigation targets use to name a page."
			] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "modes.registerMode({ id, activate })" }),
				" declares a mode. ",
				u(a.code, { children: "activate" }),
				" runs when the mode becomes active. These modes need\nno extra setup, so it returns ",
				u(a.code, { children: "undefined" }),
				"."
			] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [u(a.code, { children: "views.registerView(...)" }), " defines the page content:"] }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [u(a.code, { children: "id" }), " is the stable View identity. Page slots refer to this value."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "title" }), " is the default user-facing label."] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "body.kind: \"react\"" }),
				" allows trusted host code to return React from ",
				u(a.code, { children: "render" }),
				"."
			] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "render" }),
				" receives one render input. ",
				u(a.code, { children: "input.workbench" }),
				" exposes the running workbench services to the content."
			] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [
			"The button calls ",
			u(a.code, { children: "input.workbench.pageLocations.navigate(...)" }),
			":"
		] }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [
				"the argument is a page navigation target: ",
				u(a.code, { children: "{ kind: \"page\", page }" }),
				"."
			] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "navigate" }), " selects the target page's mode, replaces the previous page's placements with the target page's slots,\ncommits one canonical location, and updates the URL and history once."] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [u(a.code, { children: "pages.registerPage(...)" }), " declares each page:"] }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [u(a.code, { children: "id" }), " is the page's stable identity inside the host."] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "ref" }),
				" is the typed ",
				u(a.code, { children: "PageRef" }),
				" other code uses to open the page."
			] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "title" }), " is the page label."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "path" }), " is the page's stable URL segment."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "modeId" }), " names the mode that owns the page. Opening the page activates this mode."] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "main" }),
				" renders the Main view. ",
				u(a.code, { children: "slots" }),
				" declares the fixed Sidenav panel and an open panel in Side for Session or Secondary for Extension Lab. Navigation replaces the old page's owned placements together."
			] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [u(a.code, { children: "pageLocations.switchProject(\"storybook\")" }), " starts page navigation for one project. It restores that project's saved\nlocation, or opens the start page when nothing is saved."] })
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
