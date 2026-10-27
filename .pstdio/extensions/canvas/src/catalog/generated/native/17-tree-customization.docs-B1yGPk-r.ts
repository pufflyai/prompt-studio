// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-ZX3UlLq0.ts";
import i, { LayoutScopes as a, t as o } from "./onboarding.stories-B8X6Bf1U.ts";
import { t as s } from "./module-BTNLoyTW.ts";
import { createElement as c } from "react";
import { Fragment as l, jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/17-tree-customization.docs.mdx
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
			name: "15. Layout scopes"
		}),
		"\n",
		u(i.h1, { children: "15. Persist layouts at the right scope" }),
		"\n",
		u(i.p, { children: "Users can arrange panels differently per project or workspace. A layout scope selects which persisted arrangement is\nactive. Changing scope stores the old layout and restores the target layout." }),
		"\n",
		u(i.p, { children: "Scope is host state. Extensions contribute placement rules but do not choose persistence keys or restore layouts on\ntheir own." }),
		"\n",
		u(r, {
			of: a,
			sourceState: "none"
		}),
		"\n",
		u(i.h2, { children: "Complete example" }),
		"\n",
		u(e, {
			code: s,
			language: "tsx"
		}),
		"\n",
		u(i.h2, { children: "What each field means" }),
		"\n",
		u(i.p, { children: "The host wires persistence into the workbench:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [u(i.code, { children: "createWorkbench({ layoutPersistence })" }), " accepts the adapter for region layout, including size and visibility.\nThe example uses an in-memory map; a real host writes to disk or a database."] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "LayoutPersistenceAdapter" }),
				" has ",
				u(i.code, { children: "getLayout(scope)" }),
				" and ",
				u(i.code, { children: "setLayout(layout, scope)" }),
				". The workbench calls them with the\nactive scope key, so the adapter stores one layout per scope."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "Scopes name one persisted arrangement:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [
				"A ",
				u(i.code, { children: "LayoutScope" }),
				" is a string key such as ",
				u(i.code, { children: "\"project/demo/mode/tickets/resource/ticket:PS-100\"" }),
				". The host chooses the\nkey format; the workbench only uses it to store and look up state."
			] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "workbench.layout.setPersistenceScope(scope, options?)" }), " saves the current layout under the old scope and restores\nthe layout saved under the new one."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "carryRegionState: [\"sidenav\"]" }), " keeps the named regions unchanged across the switch. The example uses it so the\nproject-owned Sidenav does not remount while resource scopes rotate."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "workbench.layout.getPersistenceScope()" }), " returns the active scope key. It lives outside the store, so the example\nmirrors it in local state to drive the button highlight."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "The demo controls change state that the scope persists:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [u(i.code, { children: "workbench.layout.setRegionSize(\"secondary\", size)" }), " resizes one region."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "workbench.shell.setRegionOpen(\"secondary\", open)" }), " hides or reopens the Secondary Panel region."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "useWorkbenchStore(workbench.layout.store, selector)" }), " subscribes to the live size and visibility values so the\npanel re-renders after each switch."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "The rest is the standard module setup:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "ctx.views.registerView(...)" }),
				" defines each demo View with a React ",
				u(i.code, { children: "body" }),
				"."
			] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "ctx.shellPlacements.registerPlacement(...)" }),
				" places each View. ",
				u(i.code, { children: "item.presence: \"fixed\"" }),
				" keeps them open, and\n",
				u(i.code, { children: "region" }),
				" picks ",
				u(i.code, { children: "main" }),
				", ",
				u(i.code, { children: "sidenav" }),
				", or ",
				u(i.code, { children: "secondary" }),
				"."
			] }),
			"\n",
			u(i.li, { children: "The story seeds three scopes with different Secondary Panel sizes and open states, so switching shows a visible\ndifference." }),
			"\n"
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
