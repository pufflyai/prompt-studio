// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { W as i, t as a, v as o } from "./workbench-core-N58OeDyx.ts";
import { t as s } from "./workbench-story-B6F8bQqu.ts";
import { Box as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/region/region-tabs.stories.tsx
var f = (e = {}) => {
	let t = {
		extensionId: "storybook",
		kind: "page",
		id: "panel-tabs"
	}, n = a({
		startPage: t,
		initialSidePanelMode: "attached",
		defaultPanelOpenByRegionId: { secondary: !0 },
		regionSettings: Object.fromEntries(i.map((t) => [t, { alwaysShowTabs: e.alwaysShowTabs }]))
	});
	n.modes.registerMode({
		id: "panel-tabs",
		label: "Panel tabs",
		activate: () => void 0
	});
	for (let t of i) {
		for (let e of ["first", "second"]) {
			let r = `${t}.${e}`;
			n.views.registerView({
				id: r,
				title: `${t} ${e}`,
				body: {
					kind: "react",
					render: () => /* @__PURE__ */ u(c, {
						p: "md",
						children: /* @__PURE__ */ d(l, { children: [r, " content"] })
					})
				}
			});
		}
		if (e.actions) {
			let e = `${t}.refresh`;
			n.commands.registerCommand({
				id: e,
				label: `Refresh ${t}`,
				icon: "refresh-cw"
			}, { execute: () => void 0 }), n.layout.registerMenuItem(o(t), { commandId: e });
		}
	}
	e.menu && n.viewMenus.registerViewMenu({
		id: "inspector",
		ownerViewId: "main.first",
		viewId: "main.second",
		side: "right"
	});
	let r = i.flatMap((t) => [...t === "main" || e.menusOnly ? [] : [{
		id: `${t}.first`,
		region: t,
		item: {
			kind: "view",
			view: {
				kind: "view",
				id: `${t}.first`
			},
			presence: e.closable ? "open" : "fixed"
		}
	}], ...e.multiple ? [{
		id: `${t}.second`,
		region: t,
		item: {
			kind: "view",
			view: {
				kind: "view",
				id: `${t}.second`
			},
			presence: "open"
		}
	}] : []]);
	n.pages.registerPage({
		id: "panel-tabs",
		ref: t,
		title: "Panel tabs",
		path: "panel-tabs",
		modeId: "panel-tabs",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "main.first"
			},
			cardinality: "one"
		},
		slots: r
	});
	let s = {
		...t,
		id: "document"
	};
	if (n.pages.registerPage({
		id: "document",
		ref: s,
		title: "Document",
		path: "document",
		modeId: "panel-tabs",
		parentId: "panel-tabs",
		resource: { kinds: [{
			kind: "resource-kind",
			id: "document"
		}] },
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "main.first"
			},
			cardinality: e.cardinality ?? "one",
			...e.tabLabel ? { tab: { getSnapshot: () => ({ label: e.tabLabel }) } } : {}
		},
		slots: r
	}), n.pageLocations.switchProject("storybook-panel-tabs"), e.menusOnly) for (let e of ["secondary", "side"]) {
		let t = `${e}.menu`;
		n.layout.registerPanelMenu({
			id: t,
			title: `${e} menu`,
			region: `${e}-right-menu`,
			rendererId: `${e}.second`,
			regionCollapsible: !1
		}), n.layout.openWidget(t);
	}
	return e.resource && n.pageLocations.navigate({
		kind: "page",
		page: s,
		resource: {
			type: "document",
			id: "one",
			label: e.resourceLabel
		}
	}), n;
}, p = () => {
	let e = f();
	return e.modes.registerMode({
		id: "main-only",
		label: "Main only",
		panels: ["main"],
		activate: () => void 0
	}), e.layout.registerPlaceholder({
		id: "unavailable-menu",
		title: "Unavailable menu",
		region: "side-right-menu",
		rendererId: "side.second",
		regionCollapsible: !1
	}), e.modes.setActiveMode("main-only"), e;
}, m = {
	title: "pstdio-workbench/Reference/Core API/Panel tabs",
	component: s,
	tags: ["autodocs"],
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "Single-resource Main pages have no tab. Pages supporting many resources and optional panels keep their last tab and Close button. alwaysShowTabs overrides the single-tab default. Header actions remain available without tabs." } }
	}
}, h = {
	args: { workbench: f() },
	play: async ({ canvasElement: e }) => {
		let t = n(e);
		for (let e of i) await r(await t.findByText(`${e}.first content`)).toBeVisible();
		await r(t.queryAllByRole("tab")).toHaveLength(0);
	}
}, g = {
	args: { workbench: f({ menusOnly: !0 }) },
	play: async ({ canvasElement: e }) => {
		let t = n(e);
		for (let e of ["secondary", "side"]) await r(await t.findByText(`${e}.second content`)).toBeVisible();
		await r(t.queryAllByRole("tab")).toHaveLength(0);
	}
}, _ = {
	args: { workbench: p() },
	play: async ({ canvasElement: e }) => {
		let t = n(e);
		await r(t.queryByRole("button", { name: /(?:Show|Hide) Side Panel/ })).toBeNull(), await r(t.queryByText("side.second content")).not.toBeVisible();
	}
}, v = {
	args: { workbench: f({ alwaysShowTabs: !0 }) },
	play: async ({ canvasElement: e }) => {
		let t = n(e);
		for (let e of i) await r(await t.findByRole("tab", { name: `${e} first` })).toBeVisible();
	}
}, y = {
	args: { workbench: f({ resource: !0 }) },
	play: async ({ canvasElement: e }) => {
		let t = n(e);
		await r(await t.findByText("main.first content")).toBeVisible(), await r(t.queryAllByRole("tab")).toHaveLength(0);
	}
}, b = {
	args: { workbench: f({
		resource: !0,
		menu: !0
	}) },
	play: async ({ canvasElement: e, args: t }) => {
		let i = n(e);
		await r(await i.findByText("main.first content")).toBeVisible(), await r(await i.findByText("main.second content")).toBeVisible();
		let a = e.querySelector("[data-workbench-panel-header=\"main\"]");
		await r(a).not.toBeVisible();
		let o = t.workbench.layout.getLayout().regions["main-right-menu"].widgets[0];
		t.workbench.panelMenuState.setOpen(`panel-menu:${o.widgetId}`, !1), await r(await i.findByRole("button", { name: "Open Main right menu" })).toBeVisible(), t.workbench.panelMenuState.setOpen(`panel-menu:${o.widgetId}`, !0), await r(a).not.toBeVisible();
	}
}, x = {
	args: { workbench: f({
		resource: !0,
		cardinality: "many"
	}) },
	play: async ({ canvasElement: t }) => {
		let i = n(t);
		await e.click(await i.findByRole("button", { name: "Close main first" })), await r(i.queryByRole("button", { name: "Close main first" })).toBeNull(), await r(i.getByText("main.first content")).toBeVisible();
	}
}, S = {
	args: { workbench: f({ closable: !0 }) },
	play: async ({ canvasElement: t }) => {
		let a = n(t);
		for (let e of i) await r(await a.findByText(`${e}.first content`)).toBeVisible();
		await e.click(await a.findByRole("button", { name: "Close side first" })), await r(a.queryByText("side.first content")).toBeNull(), await r(await a.findByRole("button", { name: "Close secondary first" })).toBeVisible();
	}
}, C = {
	args: { workbench: f({
		closable: !0,
		alwaysShowTabs: !1
	}) },
	play: async ({ canvasElement: e }) => {
		await r(n(e).queryAllByRole("tab")).toHaveLength(0);
	}
}, w = {
	args: { workbench: f({
		resource: !0,
		resourceLabel: "Design notes",
		cardinality: "many"
	}) },
	play: async ({ canvasElement: t }) => {
		let i = n(t);
		await r(await i.findByRole("tab", { name: "Design notes" })).toBeVisible(), await e.click(i.getByRole("button", { name: "Close Design notes" })), await r(i.queryByRole("tab", { name: "Design notes" })).toBeNull();
	}
}, T = {
	args: { workbench: f({
		resource: !0,
		cardinality: "many",
		resourceLabel: "Design notes",
		tabLabel: "Unsaved notes",
		alwaysShowTabs: !0
	}) },
	play: async ({ canvasElement: t }) => {
		let i = n(t);
		await r(await i.findByRole("tab", { name: "Unsaved notes" })).toBeVisible(), await e.click(i.getByRole("button", { name: "Close Unsaved notes" })), await r(i.queryByRole("tab", { name: "Unsaved notes" })).toBeNull();
	}
}, E = {
	args: { workbench: f({
		closable: !0,
		alwaysShowTabs: !0
	}) },
	play: async ({ canvasElement: t }) => {
		let i = n(t), a = await i.findByRole("button", { name: "Close side first" });
		await r(a).toBeVisible(), await e.click(a), await r(i.queryByText("side.first content")).not.toBeInTheDocument(), await r(i.getByText("main.first content")).toBeVisible();
	}
}, D = {
	args: { workbench: f({
		multiple: !0,
		closable: !0
	}) },
	play: async ({ canvasElement: a }) => {
		let o = n(a), s = n(a.ownerDocument.body), c = await o.findByRole("tab", { name: "side first" });
		c.focus(), await e.keyboard("{Shift>}{F10}{/Shift}"), await r(await s.findByRole("menu", { name: "side first context menu" })).toBeVisible(), await e.keyboard("{Escape}"), await t(() => r(c).toHaveFocus());
		for (let t of i) await e.click(await o.findByRole("tab", { name: `${t} second` })), await r(await o.findByText(`${t}.second content`)).toBeVisible(), await e.click(o.getByRole("button", { name: `Close ${t} second` })), await r(await o.findByText(`${t}.first content`)).toBeVisible(), t === "main" ? await r(o.queryByRole("tab", { name: `${t} first` })).not.toBeInTheDocument() : await r(o.getByRole("button", { name: `Close ${t} first` })).toBeVisible();
	}
}, O = {
	args: { workbench: f({ actions: !0 }) },
	play: async ({ canvasElement: e }) => {
		let t = n(e);
		for (let e of i) await r(await t.findByRole("button", { name: `Refresh ${e}` })).toBeVisible();
		await r(t.queryAllByRole("tab")).toHaveLength(0);
	}
};
export { O as ActionsWithoutTabs, E as AlwaysShowClosablePanel, v as AlwaysShowTabs, x as CloseResourcePage, T as ExplicitTabLabel, C as HiddenSingleTabs, g as MenuOnlyPanels, D as MultipleItems, w as ResourceTabLabel, S as SingleClosablePanel, h as SingleItems, y as SingleResourcePage, b as SingleResourceWithMenu, _ as UnavailableMenuPanel, m as default };
