// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-ZX3UlLq0.ts";
import { t as i } from "./resource-tabs-example-CIi0cDTC.ts";
import a, { ResourceReuse as o, t as s } from "./onboarding.stories-B8X6Bf1U.ts";
import { createElement as c } from "react";
import { Fragment as l, jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/09-navigation.docs.mdx
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
			name: "10. Resource cardinality: one and many"
		}),
		"\n",
		u(a.h1, { children: "10. Compare one resource with many resource tabs" }),
		"\n",
		u(a.p, { children: "The Secondary panel starts with three tabs from two resource placements:" }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [
				u(a.strong, { children: "Inspect main" }),
				" belongs to a ",
				u(a.code, { children: "cardinality: \"one\"" }),
				" placement. Press ",
				u(a.strong, { children: "Inspect release/v0.31" }),
				". The inspector keeps one\ntab and rebinds it from ",
				u(a.code, { children: "main" }),
				" to ",
				u(a.code, { children: "release/v0.31" }),
				"."
			] }),
			"\n",
			d(a.li, { children: [
				u(a.strong, { children: "Alpha.md" }),
				" and ",
				u(a.strong, { children: "Beta.md" }),
				" belong to a ",
				u(a.code, { children: "cardinality: \"many\"" }),
				" placement. Alpha is pinned and Beta is the preview.\nPress ",
				u(a.strong, { children: "Preview Gamma" }),
				". Gamma replaces the Beta preview while Alpha stays open."
			] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [
			"Press ",
			u(a.strong, { children: "Pin Beta" }),
			" and then preview Gamma. All three documents stay available because each pinned resource identity owns a\ntab. Reopening any open resource selects its existing tab instead of making a duplicate."
		] }),
		"\n",
		d(a.p, { children: [
			"Press ",
			u(a.strong, { children: "New document" }),
			" or the ",
			u(a.strong, { children: "+" }),
			" button in Secondary to create another pinned document. Each press creates a new\nresource identity, so you can keep adding tabs beyond the three named examples."
		] }),
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
		u(a.p, { children: "The branches and documents are plain resource values:" }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [
				"each document is a ",
				u(a.code, { children: "ResourceRef" }),
				": ",
				u(a.code, { children: "{ type, id, label }" }),
				"."
			] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "type" }), " groups resources of one type. The resource placement below accepts this kind."] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "type" }),
				" and ",
				u(a.code, { children: "id" }),
				", together with any extension and project owner, identify the resource."
			] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "label" }), " is the user-facing name. The launcher passes it as the tab title."] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [
			u(a.code, { children: "inspectBranch" }),
			" and ",
			u(a.code, { children: "openDocument" }),
			" open resources through ",
			u(a.code, { children: "shellPlacements.openPlacement(...)" }),
			":"
		] }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [u(a.code, { children: "placementId" }), " names the registered resource placement to open in."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "resource" }), " is the document to show."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "title" }), " sets the tab title for this instance."] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "inspectBranch" }),
				" omits ",
				u(a.code, { children: "open" }),
				" because its placement has ",
				u(a.code, { children: "cardinality: \"one\"" }),
				"."
			] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "openDocument" }),
				" supplies the open intent. ",
				u(a.code, { children: "\"preview\"" }),
				" uses the shared preview tab, so\nthe next preview replaces it. ",
				u(a.code, { children: "\"pin\"" }),
				" keeps the tab as a persistent tab."
			] }),
			"\n",
			d(a.li, { children: [
				"the call returns a ",
				u(a.code, { children: "PlacementIdentity" }),
				" that names the created or reused instance."
			] }),
			"\n"
		] }),
		"\n",
		u(a.p, { children: "The first View and placement build the launcher:" }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "views.registerView({ id: \"guide.documents\", ... })" }),
				" renders the buttons with a ",
				u(a.code, { children: "body.kind: \"react\"" }),
				" body."
			] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "shellPlacements.registerPlacement(...)" }),
				" places it with ",
				u(a.code, { children: "item: { kind: \"view\", view: { kind: \"view\", id: viewId }, presence: \"fixed\" }" }),
				" in\n",
				u(a.code, { children: "region: \"main\"" }),
				". ",
				u(a.code, { children: "presence: \"fixed\"" }),
				" keeps the launcher always open with no close button."
			] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [
			"The document View and placement demonstrate ",
			u(a.code, { children: "cardinality: \"many\"" }),
			":"
		] }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "views.registerView({ id: \"guide.document-view\", ... })" }),
				" renders one document. ",
				u(a.code, { children: "instance.resource" }),
				" carries the\nresource bound to that instance."
			] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "item.kind: \"binding\"" }), " makes the placement resource-bound: one instance per opened resource. Resource placements\nstart empty; nothing shows until a caller opens a resource."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "item.binding.kinds: [{ kind: \"resource-kind\", id: \"document\" }]" }), " limits which resource kinds the placement accepts."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "item.binding.cardinality: \"many\"" }), " creates one tab per pinned resource identity and at most one unpinned preview tab. Reopening a\nresource selects its existing tab."] }),
			"\n",
			d(a.li, { children: [
				u(a.code, { children: "item.binding.add" }),
				" points to the New document command. The launcher and tab bar run the same command, which creates\na fresh resource and opens it with ",
				u(a.code, { children: "open: \"pin\"" }),
				"."
			] }),
			"\n",
			u(a.li, { children: "cardinality controls the instance count only. It does not control initial visibility, and it does not control\nclosability: resource tabs are always closable." }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "region: \"secondary\"" }), " puts the document tabs in the Secondary panel."] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [
			"The branch View and placement demonstrate ",
			u(a.code, { children: "cardinality: \"one\"" }),
			":"
		] }),
		"\n",
		d(a.ul, { children: [
			"\n",
			d(a.li, { children: [u(a.code, { children: "binding.kinds: [{ kind: \"resource-kind\", id: \"branch\" }]" }), " keeps branch resources separate from documents even though both placements use the same\nregion."] }),
			"\n",
			d(a.li, { children: [u(a.code, { children: "item.binding.cardinality: \"one\"" }), " keeps one inspector instance. Opening a different branch changes that instance's resource\nand title."] }),
			"\n",
			u(a.li, { children: "preview and pin do not apply because this placement can never have a second tab." }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: [
			"The onboarding story passes ",
			u(a.code, { children: "showCardinalityComparison" }),
			" to seed the inspector, a pinned Alpha document, and a Beta\npreview. The focused Panels and pages guide renders the same component without the comparison flag so readers can open\nthe ",
			u(a.code, { children: "\"many\"" }),
			" placement from an empty state."
		] })
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
