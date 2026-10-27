// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-9wQwzhjL.ts";
import i, { PageReplacement as a, ResourceRebind as o, ResourceTabs as s, StaticPlacement as c, TabPresentation as l, t as u } from "./api.stories-DokmN5_J.ts";
import { createElement as d } from "react";
import { Fragment as f, jsx as p, jsxs as m } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/api/00-api.docs.mdx
var h = { layout: "padded" };
function g(t) {
	let i = {
		code: "code",
		h1: "h1",
		h2: "h2",
		h3: "h3",
		li: "li",
		p: "p",
		ul: "ul",
		...t.components
	};
	return m(f, { children: [
		p(n, {
			of: u,
			name: "Guide",
			parameters: { layout: "padded" }
		}),
		"\n",
		p(i.h1, { children: "Placements and pages" }),
		"\n",
		m(i.p, { children: [
			"This guide uses the Core API from ",
			p(i.code, { children: "@pstdio/workbench" }),
			". A View defines content. A placement puts that View in a region\nfor the lifetime of the shell, a mode, or a page. The workbench renders panel chrome around each placement instance.\nAuthors do not register panels."
		] }),
		"\n",
		m(i.p, { children: [
			"A placement's ",
			p(i.code, { children: "item" }),
			" decides its lifecycle:"
		] }),
		"\n",
		m(i.ul, { children: [
			"\n",
			m(i.li, { children: [
				"A static item (",
				p(i.code, { children: "kind: \"view\"" }),
				") has one instance and declares a ",
				p(i.code, { children: "presence" }),
				": ",
				p(i.code, { children: "\"fixed\"" }),
				" placements always show and\ncannot close, ",
				p(i.code, { children: "\"open\"" }),
				" placements start open and the user may close them, ",
				p(i.code, { children: "\"closed\"" }),
				" placements stay hidden until an\naction or the Add panel opens them. A saved user choice wins over ",
				p(i.code, { children: "\"open\"" }),
				" and ",
				p(i.code, { children: "\"closed\"" }),
				" on the next visit."
			] }),
			"\n",
			m(i.li, { children: [
				"A resource item uses ",
				p(i.code, { children: "kind: \"binding\"" }),
				" and ",
				p(i.code, { children: "binding: { kinds, view, cardinality, add? }" }),
				".\n",
				p(i.code, { children: "cardinality: \"one\"" }),
				" rebinds one instance; ",
				p(i.code, { children: "\"many\"" }),
				" retains independent resource instances.\nIt has no initial visibility: nothing shows until an action supplies a resource."
			] }),
			"\n"
		] }),
		"\n",
		m(i.p, { children: [
			"Opening always goes through the shared navigation executor. ",
			p(i.code, { children: "workbench.navigation.openPage(...)" }),
			" navigates to a page,\nand ",
			p(i.code, { children: "workbench.navigation.openPanel(...)" }),
			" opens or activates a declared placement."
		] }),
		"\n",
		p(i.h2, { children: "Static placement and presence" }),
		"\n",
		m(i.p, { children: [
			"The View and placement have different ids in this example. The placement declares ",
			p(i.code, { children: "presence: \"closed\"" }),
			", so nothing\nshows at registration; the module opens it through ",
			p(i.code, { children: "navigation.openPanel" }),
			". Press the button inside the workbench:\nopening the placement again selects its existing ",
			p(i.code, { children: "default" }),
			" instance."
		] }),
		"\n",
		p(r, {
			of: c,
			sourceState: "none"
		}),
		"\n",
		p(e, { of: c }),
		"\n",
		p(i.h3, { children: "What each field means" }),
		"\n",
		m(i.ul, { children: [
			"\n",
			m(i.li, { children: [p(i.code, { children: "views.registerView({ id, title, body })" }), " defines reusable content. Registering a View opens nothing."] }),
			"\n",
			m(i.li, { children: [p(i.code, { children: "shellPlacements.registerPlacement({ id, item, region })" }), " declares one shell-owned placement."] }),
			"\n",
			m(i.li, { children: [p(i.code, { children: "item.kind: \"view\"" }), " makes this a static placement with a single instance."] }),
			"\n",
			m(i.li, { children: [p(i.code, { children: "item.view" }), " names the registered View to render."] }),
			"\n",
			m(i.li, { children: [
				p(i.code, { children: "item.presence: \"closed\"" }),
				" keeps the placement hidden until something opens it. ",
				p(i.code, { children: "\"open\"" }),
				" would show it right away,\nand ",
				p(i.code, { children: "\"fixed\"" }),
				" would show it permanently with no close button."
			] }),
			"\n",
			m(i.li, { children: [p(i.code, { children: "region: \"main\"" }), " selects the region that hosts the instance."] }),
			"\n",
			m(i.li, { children: [p(i.code, { children: "navigation.openPanel({ panel: { kind: \"shell-placement\", id } })" }), " opens the placement through the shared executor.\nOpening an already-open static placement activates the existing instance instead of adding a tab."] }),
			"\n"
		] }),
		"\n",
		m(i.h2, { children: ["Resource placement with ", p(i.code, { children: "cardinality: \"many\"" })] }),
		"\n",
		m(i.p, { children: [
			"The placement binds one View to the ",
			p(i.code, { children: "document" }),
			" resource kind with ",
			p(i.code, { children: "cardinality: \"many\"" }),
			". Preview Alpha, then Preview\nBeta: Beta replaces the unpinned Alpha preview. Pin a document before previewing the other one to keep both tabs.\nCardinality controls only how instances map to resources. It does not control initial visibility (a resource placement\nalways starts empty) and it does not control closability (resource tabs are always closable)."
		] }),
		"\n",
		p(r, {
			of: s,
			sourceState: "none"
		}),
		"\n",
		p(e, { of: s }),
		"\n",
		p(i.h3, { children: "What each field means" }),
		"\n",
		m(i.ul, { children: [
			"\n",
			m(i.li, { children: [p(i.code, { children: "item.kind: \"binding\"" }), " makes this placement resource-bound: each opened resource becomes one instance."] }),
			"\n",
			m(i.li, { children: [p(i.code, { children: "item.binding.kinds" }), " lists the resource kinds this placement accepts."] }),
			"\n",
			m(i.li, { children: [p(i.code, { children: "item.binding.cardinality: \"many\"" }), " keeps one instance per resource identity. Opening the same resource again selects its\nexisting tab instead of duplicating it."] }),
			"\n",
			m(i.li, { children: [p(i.code, { children: "openPlacement({ placementId, resource, open })" }), " supplies the resource that creates or selects an instance."] }),
			"\n",
			m(i.li, { children: [
				p(i.code, { children: "open: \"preview\"" }),
				" creates a replaceable tab; the next preview replaces it. ",
				p(i.code, { children: "open: \"pin\"" }),
				" keeps the tab while other\nresources open. The open intent applies only to ",
				p(i.code, { children: "\"many\"" }),
				" placements."
			] }),
			"\n",
			m(i.li, { children: [p(i.code, { children: "title" }), " labels the instance tab; without it the tab uses the resource label."] }),
			"\n"
		] }),
		"\n",
		m(i.h2, { children: ["Resource placement with ", p(i.code, { children: "cardinality: \"one\"" })] }),
		"\n",
		m(i.p, { children: [
			"The inspector declares ",
			p(i.code, { children: "cardinality: \"one\"" }),
			". Open main, then release: the placement keeps one instance and rebinds it\nto the newest resource. Use ",
			p(i.code, { children: "\"one\"" }),
			" for inspectors and detail panels that always follow the latest selection."
		] }),
		"\n",
		p(r, {
			of: o,
			sourceState: "none"
		}),
		"\n",
		p(e, { of: o }),
		"\n",
		p(i.h3, { children: "What each field means" }),
		"\n",
		m(i.ul, { children: [
			"\n",
			m(i.li, { children: [p(i.code, { children: "item.binding.cardinality: \"one\"" }), " keeps a single instance. Opening resource B while A is open rebinds the same instance to\nB; no second tab appears."] }),
			"\n",
			m(i.li, { children: [
				"Open intent (",
				p(i.code, { children: "\"preview\"" }),
				" and ",
				p(i.code, { children: "\"pin\"" }),
				") is not accepted here because there is never more than one tab."
			] }),
			"\n",
			m(i.li, { children: [
				"Everything else matches the ",
				p(i.code, { children: "\"many\"" }),
				" example: the placement starts empty, and its one instance closes like any\nresource tab. Cardinality never changes initial visibility or closability."
			] }),
			"\n"
		] }),
		"\n",
		p(i.h2, { children: "Tab presentation" }),
		"\n",
		p(i.p, { children: "A tab may replace its View icon with a dynamic status indicator. The workbench renders the indicator as the one leading\nglyph instead of showing the indicator and View icon together." }),
		"\n",
		p(r, {
			of: l,
			sourceState: "none"
		}),
		"\n",
		p(e, { of: l }),
		"\n",
		p(i.h3, { children: "What each field means" }),
		"\n",
		m(i.ul, { children: [
			"\n",
			m(i.li, { children: [p(i.code, { children: "tab.query" }), " returns the current tab snapshot: an optional label, icon, indicator, and menu."] }),
			"\n",
			m(i.li, { children: [p(i.code, { children: "tab.refreshEvents" }), " lists the events that invalidate the snapshot and re-run the query."] }),
			"\n",
			m(i.li, { children: [p(i.code, { children: "indicator" }), " supplies a leading status glyph with an optional color and accessible label."] }),
			"\n"
		] }),
		"\n",
		p(i.h2, { children: "Page composition" }),
		"\n",
		m(i.p, { children: [
			"A page declares its Main content through ",
			p(i.code, { children: "main" }),
			" and additional panels through ",
			p(i.code, { children: "slots" }),
			". Navigating to another page replaces that placement set in one\noperation. Mode-owned placements remain only when the target page uses that mode."
		] }),
		"\n",
		p(i.p, { children: "This example begins on the Session page. Its action navigates to Lab. The Lab page replaces the Session content\ninstead of opening beside it." }),
		"\n",
		p(r, {
			of: a,
			sourceState: "none"
		}),
		"\n",
		p(e, { of: a }),
		"\n",
		p(i.h3, { children: "What each field means" }),
		"\n",
		m(i.ul, { children: [
			"\n",
			m(i.li, { children: [p(i.code, { children: "pages.registerPage({ id, ref, path, modeId, resource?, main, slots })" }), " declares a routed page."] }),
			"\n",
			m(i.li, { children: [p(i.code, { children: "resource: { kinds }" }), " constrains the route independently of its presentation."] }),
			"\n",
			m(i.li, { children: [
				p(i.code, { children: "main: { kind: \"view\", view, cardinality }" }),
				" renders routed content. ",
				p(i.code, { children: "\"many\"" }),
				" requires a resource-bound page."
			] }),
			"\n",
			m(i.li, { children: [p(i.code, { children: "main: { kind: \"panels\", empty }" }), " renders peer Main panels and an empty-state view when none are open."] }),
			"\n",
			m(i.li, { children: [
				p(i.code, { children: "slots" }),
				" contains additional panels. Each uses ",
				p(i.code, { children: "item: { kind: \"view\", view, presence }" }),
				" or ",
				p(i.code, { children: "item: { kind: \"binding\", binding: { kinds, view, cardinality, add? } }" }),
				"."
			] }),
			"\n",
			m(i.li, { children: [p(i.code, { children: "navigation.openPage({ page, resource? })" }), " selects the page's mode, commits one canonical location, updates URL and\nhistory once, and reconciles the page placements in one operation."] }),
			"\n"
		] })
	] });
}
function _(e = {}) {
	let { wrapper: t } = e.components || {};
	return t ? p(t, {
		...e,
		children: p(g, { ...e })
	}) : g(e);
}
function v() {
	return d(t, {
		component: _,
		annotations: i
	});
}
export { v as default, h as parameters };
