// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-9wQwzhjL.ts";
import i, { SidenavLevels as a, n as o, t as s } from "./onboarding.stories-Now-_M4N.ts";
import { createElement as c } from "react";
import { Fragment as l, jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/21-sidenav-levels.docs.mdx
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
			of: s,
			name: "17. Sidenav levels"
		}),
		"\n",
		u(i.h1, { children: "17. Give a page its own Sidenav level" }),
		"\n",
		d(i.p, { children: [
			"A page can own a ",
			u(i.code, { children: "content" }),
			" navigation tree. Opening that page starts a Sidenav level: the page's sections replace the\nmode's body, so the Sidenav shows only what belongs to the page. Header and footer rows stay."
		] }),
		"\n",
		u(i.p, { children: "Press Recipes to enter the level. The recipe list replaces the project rows, while Pantry stays in the header. Open a\nrecipe: its page declares Recipes as its parent, so the level stays open. Press the fixed ← Project button at the\ntop of the main navigation content to return to the main level. It shows the current mode name and cannot be moved or hidden.\nThe breadcrumb and browser history also remain available." }),
		"\n",
		u(r, {
			of: a,
			sourceState: "none"
		}),
		"\n",
		u(i.h2, { children: "Complete example" }),
		"\n",
		u(e, {
			code: o,
			language: "tsx"
		}),
		"\n",
		u(i.h2, { children: "What each field means" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [u(i.code, { children: "defineNavigationItem({ owner: workbenchModes.project, slot: \"header\" })" }), " adds a header row to the mode. Header and\nfooter rows accumulate from the mode through every open level, so they stay visible in nested levels."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "defineNavigationItem({ slot: \"content\", action: { kind: \"page\", page } })" }), " adds the one main-level row that opens\nthe level page."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "defineNavigationTree({ owner: recipesPage.ref, slot: \"content\", view })" }), " gives the page its own tree. A page owner\nstarts a level; a mode owner adds sections to the main level instead."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "resourceScope: \"project\"" }), " reads the tree once for the project. Selecting a recipe keeps its rows visible."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "parent: recipesPage.ref" }), " on the recipe page keeps the Recipes level open for every recipe. Levels follow the page\nlocation's parent chain, so a level page opened from another level nests inside it."] }),
			"\n",
			d(i.li, { children: [
				"Rows set ",
				u(i.code, { children: "resource" }),
				" as their action subject and ",
				u(i.code, { children: "target" }),
				" as their click destination."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "Users can drag rows into the header or footer. Those rows also stay visible inside levels. In the customize menu, users\ncan hide a level's labeled sections but not its rows. The mode return button stays first in the main navigation content, with the same spacing as other entries." }),
		"\n",
		u(i.h2, { children: "Leaving a level" }),
		"\n",
		u(i.p, { children: "When a child page uses the same resource as its parent, its breadcrumb shows the child page title. The parent keeps the resource label, so the trail names both the resource and the current page." }),
		"\n",
		u(i.p, { children: "A level page with no declared parent, such as Recipes, starts the breadcrumb. The host provides a mode return entry\nin the navigation panel so users can leave the level." }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [
				"Every breadcrumb item that opens a level carries ",
				u(i.code, { children: "startsLevel: true" }),
				". So does an item whose page belongs to a mode\nthat sets ",
				u(i.code, { children: "chrome.sidenav" }),
				", because that mode also hides the project rows. Hosts can read ",
				u(i.code, { children: "items[0].startsLevel" }),
				"\nwhen adding their own navigation controls."
			] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "workbench.pageLocations.navigateToRootLevel()" }), " opens the last location outside every level and every such mode, or\nthe start page when there is none. The workbench records that location on every navigation and saves it with the current location, so it\nsurvives a reload."] }),
			"\n",
			u(i.li, { children: "In Prompt Studio, the mode return entry and the active desktop project tab call the same operation. The desktop\nbreadcrumb shows only page and resource crumbs. The browser navbar also keeps the project avatar and title as a\nreturn control." }),
			"\n"
		] }),
		"\n",
		u(i.h2, { children: "Host API" }),
		"\n",
		d(i.p, { children: [u(i.code, { children: "createLevelNavigation(workbench)" }), " composes one navigation tree from the active mode and every open level. Hosts use\nit to fill their navigation view:"] }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "getSections(slot, signal, onProgress)" }),
				" returns the sections for ",
				u(i.code, { children: "header" }),
				", ",
				u(i.code, { children: "content" }),
				", or ",
				u(i.code, { children: "footer" }),
				". Pass the tree\nquery's ",
				u(i.code, { children: "onProgress" }),
				" callback to show ready sections while slower contributions finish. Results keep their declared order."
			] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "getReadKey()" }), " changes when the owners or their resources change, so the tree starts a new read."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "getDefaultExpandedSectionIds()" }), " lists the sections that start expanded."] }),
			"\n"
		] }),
		"\n",
		d(i.p, { children: [
			"Outer body rows are returned with ",
			u(i.code, { children: "pinnedOnly: true" }),
			". The tree view shows them only where users pinned them."
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
		annotations: i
	});
}
export { m as default };
