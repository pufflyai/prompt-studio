// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-kaLFKJEn.ts";
import { t as a } from "./workbench-BbqJVWhj.ts";
import { t as o } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as s } from "react";
import { Box as c, Text as l } from "@chakra-ui/react";
import { jsx as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/panel-menu/panel-menu.stories.tsx
var d = (e) => {
	let t = {
		extensionId: "storybook",
		kind: "page",
		id: "menus"
	}, n = i({ startPage: t });
	n.modes.registerMode({
		id: "menus",
		activate: () => void 0
	}), n.views.registerView({
		id: "document",
		title: "Document",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ u(l, {
				p: "md",
				children: "Project notes"
			})
		}
	});
	for (let t of e.both ? ["left", "right"] : ["right"]) n.views.registerView({
		id: t,
		title: `${t} inspector`,
		body: {
			kind: "react",
			render: () => e.embedded ? /* @__PURE__ */ u(c, {
				h: "full",
				display: "flex",
				minH: "0",
				children: /* @__PURE__ */ u("iframe", {
					title: "Embedded controls",
					srcDoc: "<button>Copy Link</button>",
					width: "100%",
					height: "100%"
				})
			}) : /* @__PURE__ */ u(c, {
				p: "sm",
				children: (e.tall ? Array.from({ length: 80 }, (e, t) => t) : [0]).map((e) => /* @__PURE__ */ u(l, { children: "Inspector details" }, e))
			})
		}
	}), n.viewMenus.registerViewMenu({
		id: t,
		ownerViewId: "document",
		viewId: t,
		side: t,
		regionSize: e.menuMinPx ? {
			minPx: e.menuMinPx,
			maxPx: 320
		} : void 0
	});
	n.pages.registerPage({
		id: "menus",
		ref: t,
		title: "Notes",
		path: "menus",
		modeId: "menus",
		slots: [],
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "document"
			},
			cardinality: "one"
		}
	}), n.pageLocations.switchProject("menu-stories");
	for (let t of e.closed ?? []) {
		let e = n.layout.getLayout().regions[`main-${t}-menu`].widgets[0];
		n.panelMenuState.setOpen(`panel-menu:${e.widgetId}`, !1);
	}
	return n;
}, f = {
	title: "pstdio-workbench/Reference/Core API/Panel menus",
	component: (e) => {
		let { width: t, menus: n } = e, [r] = s(() => d(n));
		return /* @__PURE__ */ u(o, { children: /* @__PURE__ */ u(c, {
			"data-testid": "panel-menu-story-frame",
			w: t,
			h: "100dvh",
			children: /* @__PURE__ */ u(a, { workbench: r })
		}) });
	},
	parameters: { layout: "fullscreen" }
}, p = {
	args: {
		width: 700,
		menus: { closed: ["right"] }
	},
	play: async ({ canvasElement: i }) => {
		let a = n(i);
		await r(await a.findByRole("tab", { name: "Document" })).toBeVisible(), await r(a.queryByRole("button", { name: "Close Document" })).toBeNull(), await e.click(await a.findByRole("button", { name: "Open Main right menu" })), await t(() => r(i.querySelector("[data-workbench-panel-menu=\"main-right\"]")).toBeVisible()), await r(a.queryByRole("button", { name: "Open Main right menu" })).toBeNull(), await r(a.queryAllByRole("tab")).toHaveLength(0), await r(i.querySelector("[data-workbench-panel-header=\"main\"]")).not.toBeVisible(), await e.dblClick(a.getByRole("separator", { name: "Resize Main right menu" })), await r(await a.findByRole("tab", { name: "Document" })).toBeVisible(), await e.click(await a.findByRole("button", { name: "Open Main right menu" })), await t(() => r(i.querySelector("[data-workbench-panel-menu=\"main-right\"]")).toBeVisible());
	}
}, m = {
	args: {
		width: 500,
		menus: { closed: ["right"] }
	},
	play: async ({ canvasElement: i }) => {
		let a = n(i);
		await r(await a.findByRole("tab", { name: "Document" })).toBeVisible(), await r(a.queryByRole("button", { name: "Close Document" })).toBeNull(), await e.click(await a.findByRole("button", { name: "Open Main right menu" }));
		let o = await n(i.ownerDocument.body).findByRole("menu", { name: "Main right menu controls" });
		await t(() => r(o.getBoundingClientRect().height).toBeLessThan(200));
	}
}, h = {
	args: {
		width: 500,
		menus: {
			closed: ["right"],
			embedded: !0
		}
	},
	play: async ({ canvasElement: i }) => {
		let a = n(i);
		await e.click(await a.findByRole("button", { name: "Open Main right menu" }));
		let o = await n(i.ownerDocument.body).findByRole("menu", { name: "Main right menu controls" });
		await t(() => r(o.querySelector("iframe").getBoundingClientRect().height).toBeGreaterThan(100));
	}
}, g = {
	args: {
		width: 500,
		menus: {
			closed: ["right"],
			tall: !0
		}
	},
	play: async ({ canvasElement: i }) => {
		let a = n(i);
		await e.click(await a.findByRole("button", { name: "Open Main right menu" }));
		let o = await n(i.ownerDocument.body).findByRole("menu", { name: "Main right menu controls" });
		await t(() => {
			let e = o.getBoundingClientRect(), t = i.ownerDocument.defaultView.innerHeight;
			r(e.bottom).toBeLessThanOrEqual(t), r(e.height).toBeGreaterThan(t - e.top - 20);
		});
		let s = n(o).getAllByText("Inspector details").at(-1);
		s.scrollIntoView(), await t(() => r(s.getBoundingClientRect().bottom).toBeLessThanOrEqual(o.getBoundingClientRect().bottom));
	}
}, _ = {
	args: {
		width: 700,
		menus: { both: !0 }
	},
	play: async ({ canvasElement: i }) => {
		for (let e of ["left", "right"]) await t(() => r(i.querySelector(`[data-workbench-panel-menu="main-${e}"]`)).toBeVisible());
		let a = n(i).getByText("Project notes");
		await r(a.getBoundingClientRect().width).toBeGreaterThanOrEqual(120), n(i).getByRole("separator", { name: "Resize Main left menu" }).focus(), await e.keyboard("{End}"), await r(a.getBoundingClientRect().width).toBeGreaterThanOrEqual(120);
	}
}, v = { args: {
	width: 650,
	menus: {
		both: !0,
		menuMinPx: 300
	}
} }, y = {
	args: {
		width: 650,
		menus: {
			both: !0,
			closed: ["left"],
			menuMinPx: 300
		}
	},
	play: async ({ canvasElement: i }) => {
		let a = n(i), o = () => i.querySelector("[data-workbench-panel-menu=\"main-right\"]");
		await t(() => r(o()).toBeVisible()), await e.click(await a.findByRole("button", { name: "Open Main left menu" })), await n(i.ownerDocument.body).findByRole("menu", { name: "Main left menu controls" }), await r(i.querySelector("[data-workbench-panel-menu=\"main-left\"]")).not.toBeVisible(), await r(o()).toBeVisible();
	}
}, b = {
	args: {
		width: 240,
		menus: {}
	},
	play: async ({ canvasElement: i }) => {
		let a = n(i);
		await e.click(await a.findByRole("button", { name: "Open Main right menu" })), await n(i.ownerDocument.body).findByRole("menu", { name: "Main right menu controls" }), await e.keyboard("{Escape}"), a.getByTestId("panel-menu-story-frame").style.width = "700px", await t(() => r(i.querySelector("[data-workbench-panel-menu=\"main-right\"]")).toBeVisible());
	}
};
export { _ as BothMenusAttached, h as FloatingEmbeddedContent, y as FloatingPeekKeepsAttachedMenu, b as FloatingPeekKeepsOpenPreference, g as FloatingTallContent, m as FloatingWhenNarrow, v as OneMenuFits, p as ReopenAttached, f as default };
