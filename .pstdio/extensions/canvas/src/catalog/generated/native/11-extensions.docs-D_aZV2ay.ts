// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-9wQwzhjL.ts";
import { t as i } from "./page-extension-DNMEVn7b.ts";
import a, { FirstExtensionPage as o, t as s } from "./onboarding.stories-B8X6Bf1U.ts";
import { createElement as c } from "react";
import { Fragment as l, jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/11-extensions.docs.mdx
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
			name: "3. First extension page"
		}),
		"\n",
		u(a.h1, { children: "3. Build the first extension page" }),
		"\n",
		d(a.p, { children: [
			"This extension declares three native file views, places each on a page, and adds sidebar links to open them.\nChoose ",
			u(a.strong, { children: "Pages" }),
			" or ",
			u(a.strong, { children: "Views" }),
			" in the sidebar. The content in Main changes, and the back button returns to the previous page."
		] }),
		"\n",
		u(r, {
			of: o,
			sourceState: "shown"
		}),
		"\n",
		u(a.h2, { children: "Complete example" }),
		"\n",
		d(a.p, { children: [
			"The story runs this extension definition. It uses only the public Extension API from ",
			u(a.code, { children: "@pstdio/sdk/extensions" }),
			"."
		] }),
		"\n",
		u(e, {
			code: i,
			language: "tsx"
		}),
		"\n",
		u(a.h2, { children: "What each field means" }),
		"\n",
		d(a.p, { children: [u(a.code, { children: "defineView(...)" }), " creates reusable content:"] }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "id" }),
				" is the View's stable local identity. Its ",
				u(a.code, { children: "ref" }),
				" is the typed reference other definitions use."
			] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "title" }), " is its default user-facing label."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "body.kind: \"file\"" }), " asks the host to render a native file view."] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "load" }),
				" returns the file name and content. A ",
				u(a.code, { children: ".md" }),
				" name selects the Markdown renderer."
			] }),
			"\n",
			d(a.li, { children: [
				"Omitting ",
				u(a.code, { children: "save" }),
				" makes the content read-only."
			] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [u(a.code, { children: "definePage(...)" }), " creates the location that owns the View placement:"] }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "id" }),
				" creates the page's typed ",
				u(a.code, { children: "ref" }),
				"."
			] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "title" }), " is the page label."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "path" }), " is the page's stable URL segment."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "mode: workbenchModes.project" }), " makes the page available in Project mode."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "main: { kind: \"view\", view: view.ref, cardinality: \"one\" }" }), " renders the matching document in Main."] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [u(a.code, { children: "defineNavigationItem(...)" }), " creates the action visible inside the workbench:"] }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [u(a.code, { children: "owner" }), " puts the item in Project mode's navigation tree."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "slot: \"content\"" }), " places it in the scrolling middle area, below pinned header content and above pinned footer content."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "group: \"Learn\"" }), " places it under a visible Learn section."] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "label" }),
				" and ",
				u(a.code, { children: "icon" }),
				" describe the row."
			] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "action" }),
				" is a navigation target. ",
				u(a.code, { children: "{ kind: \"page\", page: page.ref }" }),
				" opens that page. Page navigation\nreplaces the previous page placements instead of appending to them."
			] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [
			"Finally, ",
			u(a.code, { children: "defineExtension(...)" }),
			" exports the views, pages, and navigation items as one installable unit. The host loads, validates, and\nremoves them together. Registering the View alone would show nothing; the page places it, and the navigation item gives\nthe user a way to reach it."
		] }),
		"\n",
		u(a.p, { children: "The Storybook preview supplies a host sidebar that renders Project mode's navigation items. An installed extension uses\nthe dashboard's sidebar. The sidebar is separate from each page's Main content." })
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
